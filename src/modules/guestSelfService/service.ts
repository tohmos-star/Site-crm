import type { PrismaClient } from "@prisma/client";
import { DomainError, ForbiddenError, NotFoundError } from "../../lib/errors.js";
import { TariffService } from "../tariffs/service.js";
import { BalanceService } from "../balance/service.js";
import { LoyaltyService } from "../loyalty/service.js";
import { SessionService } from "../bookings/session.service.js";
import { PaymentService } from "../payments/service.js";
import { RefundService } from "../refunds/service.js";

// Гостевые действия, для которых раньше не было своей ручки под гостевой
// JWT — только под admin-JWT (топап/возврат/тарифы лояльности) или под
// device-токен станции (сессии — см. pcAgent). Тут то же самое, что уже
// умеет домен (SessionService/PaymentService/RefundService/LoyaltyService),
// просто guestId берётся из токена, а не из тела запроса/device-токена, и
// добавлена проверка владения (гость может тронуть только свою сессию).
//
// Явно НЕ дублируем: activateFromBooking (ввод кода — остаётся действием
// станции, см. android/GuestRepository.redeemCode) и завершение сессии с
// отчётом о чистоте места — для этого уже есть публичная
// POST /api/session-reports (sessionId как разовый предъявитель, см.
// src/modules/sessionReports).
export class GuestSelfServiceService {
  private readonly tariffs: TariffService;
  private readonly balance: BalanceService;
  private readonly loyalty: LoyaltyService;
  private readonly sessions: SessionService;
  private readonly payments: PaymentService;
  private readonly refunds: RefundService;

  constructor(private readonly prisma: PrismaClient) {
    this.tariffs = new TariffService(prisma);
    this.balance = new BalanceService(prisma);
    this.loyalty = new LoyaltyService(prisma);
    this.sessions = new SessionService(prisma);
    this.payments = new PaymentService(prisma);
    this.refunds = new RefundService(prisma);
  }

  async quoteBooking(guestId: string, stationId: string, minutes: number, startAt?: string) {
    const device = await this.prisma.device.findUnique({ where: { id: stationId }, include: { zone: true } });
    if (!device) throw new NotFoundError("Device", stationId);
    if (!device.zone.defaultTariffId) {
      throw new DomainError(
        "NO_DEFAULT_TARIFF",
        "У зоны этого места не настроен тариф для быстрой брони — обратитесь к администратору",
        500,
      );
    }

    const tariff = await this.tariffs.getTariff(device.zone.defaultTariffId);
    const quote = await this.tariffs.quote({
      tariffId: device.zone.defaultTariffId,
      zoneId: device.zoneId,
      startAt: startAt ? new Date(startAt) : new Date(),
      durationMinutes: minutes,
    });
    const { discountPercent, cashbackPercent } = tariff.ignoreLoyaltyDiscounts
      ? { discountPercent: 0, cashbackPercent: 0 }
      : await this.loyalty.getEffectiveLoyalty(guestId, device.clubId);
    const amount = quote.price.mul(100 - discountPercent).div(100);

    return {
      baseAmountRub: Math.round(Number(quote.price)),
      amountRub: Math.round(Number(amount)),
      paidMinutes: quote.paidMinutes,
      discountPercent,
      cashbackRub: Math.round(Number(amount.mul(cashbackPercent).div(100))),
    };
  }

  async startWalkInSession(guestId: string, stationId: string, minutes: number) {
    const device = await this.prisma.device.findUnique({ where: { id: stationId }, include: { zone: true } });
    if (!device) throw new NotFoundError("Device", stationId);
    if (device.status !== "FREE") {
      throw new DomainError("DEVICE_NOT_FREE", `Device ${stationId} is ${device.status}`, 409);
    }
    if (!device.zone.defaultTariffId) {
      throw new DomainError(
        "NO_DEFAULT_TARIFF",
        "У зоны этого места не настроен тариф для быстрой брони — обратитесь к администратору",
        500,
      );
    }

    const existing = await this.prisma.session.findFirst({
      where: { guestId, status: { in: ["ACTIVE", "PENDING_PAYMENT"] } },
    });
    if (existing) {
      throw new DomainError("ALREADY_HAS_ACTIVE_SESSION", "У вас уже есть активная сессия", 409);
    }

    // Проверяем баланс до старта, а не после — иначе неудачный choosePlanForWalkIn
    // оставит устройство в CONNECTING до истечения 5-минутного окна впустую.
    const tariff = await this.tariffs.getTariff(device.zone.defaultTariffId);
    const quote = await this.tariffs.quote({
      tariffId: device.zone.defaultTariffId,
      zoneId: device.zoneId,
      startAt: new Date(),
      durationMinutes: minutes,
    });
    const { discountPercent } = tariff.ignoreLoyaltyDiscounts
      ? { discountPercent: 0 }
      : await this.loyalty.getEffectiveLoyalty(guestId, device.clubId);
    const priceToCharge = quote.price.mul(100 - discountPercent).div(100);
    const available = await this.balance.getBalance(guestId, "MONEY");
    if (priceToCharge.gt(available)) {
      throw new DomainError(
        "INSUFFICIENT_BALANCE",
        `Недостаточно средств: нужно ${priceToCharge.toString()}, доступно ${available.toString()}`,
        422,
      );
    }

    const session = await this.sessions.startWalkIn(stationId, guestId);
    try {
      const activated = await this.sessions.choosePlanForWalkIn(session.id, {
        tariffId: device.zone.defaultTariffId,
        durationMinutes: minutes,
      });
      return this.describeSession(activated.id);
    } catch (error) {
      await this.sessions.expireWalkIn(session.id).catch(() => undefined);
      throw error;
    }
  }

  async activeSession(guestId: string) {
    const session = await this.prisma.session.findFirst({
      where: { guestId, status: { in: ["ACTIVE", "PENDING_PAYMENT"] } },
      orderBy: { startedAt: "desc" },
    });
    if (!session) return null;
    return this.describeSession(session.id);
  }

  async extendSession(guestId: string, sessionId: string, minutes: number) {
    await this.assertOwnedByGuest(guestId, sessionId);
    await this.sessions.extend(sessionId, minutes);
    return this.describeSession(sessionId);
  }

  async topUp(guestId: string, amount: number) {
    const result = await this.payments.topUp({ guestId, amount, sourceChannel: "APP" });
    const balanceRub = Math.round(Number(await this.balance.getBalance(guestId, "MONEY")));
    return { id: result.id, amountRub: Math.round(Number(result.amount)), balanceRub };
  }

  async requestRefund(guestId: string, amount: number, reason?: string) {
    const refund = await this.refunds.create({ guestId, amount, reason });
    return { id: refund.id, amountRub: Math.round(Number(refund.amount)), status: refund.status.toLowerCase() };
  }

  myRefundRequests(guestId: string) {
    return this.refunds.list(guestId);
  }

  listLoyaltyTiers() {
    return this.loyalty.listTiers();
  }

  private async assertOwnedByGuest(guestId: string, sessionId: string) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundError("Session", sessionId);
    if (session.guestId !== guestId) {
      throw new ForbiddenError("Эта сессия принадлежит другому гостю");
    }
    return session;
  }

  private async describeSession(sessionId: string) {
    const session = await this.prisma.session.findUniqueOrThrow({
      where: { id: sessionId },
      include: { device: true },
    });

    let tariffPerHour = 0;
    if (session.tariffId) {
      const quote = await this.tariffs.quote({
        tariffId: session.tariffId,
        zoneId: session.device.zoneId,
        startAt: new Date(),
        durationMinutes: 60,
      });
      tariffPerHour = Math.round(Number(quote.price));
    }

    const guestBalanceRub = Math.round(Number(await this.balance.getBalance(session.guestId, "MONEY")));

    return {
      id: session.id,
      status: session.status,
      stationLabel: session.device.name,
      endsAt: session.endsAt,
      tariffPerHour,
      guestBalanceRub,
    };
  }
}
