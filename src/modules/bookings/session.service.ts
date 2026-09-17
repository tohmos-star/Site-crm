import type { PrismaClient } from "@prisma/client";
import { DomainError, NotFoundError } from "../../lib/errors.js";
import { BalanceService } from "../balance/service.js";
import { TariffService } from "../tariffs/service.js";
import { LoyaltyService } from "../loyalty/service.js";
import { capExtension } from "./rules.js";
import type { ChoosePlanBody } from "./schemas.js";

const WALK_IN_PAYMENT_WINDOW_MINUTES = 5; // "5 минут на выбор и оплату тарифа"

export class SessionService {
  private readonly balance: BalanceService;
  private readonly tariffs: TariffService;
  private readonly loyalty: LoyaltyService;

  constructor(private readonly prisma: PrismaClient) {
    this.balance = new BalanceService(prisma);
    this.tariffs = new TariffService(prisma);
    this.loyalty = new LoyaltyService(prisma);
  }

  async get(id: string) {
    const session = await this.prisma.session.findUnique({ where: { id } });
    if (!session) throw new NotFoundError("Session", id);
    return session;
  }

  // Гость вводит код брони на полноэкранном экране устройства. Код действует
  // строго до booking.endAt, без грейс-периода.
  async activateFromBooking(code: string, deviceId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { code } });
    if (!booking || booking.deviceId !== deviceId) {
      throw new DomainError("INVALID_CODE", "Booking code not found for this device", 404);
    }
    if (booking.status !== "SCHEDULED") {
      throw new DomainError("BOOKING_NOT_ACTIVATABLE", `Booking is ${booking.status}`, 409);
    }
    if (new Date() > booking.endAt) {
      throw new DomainError("CODE_EXPIRED", "Booking code expired (no grace period)", 410);
    }

    return this.prisma.$transaction(async (tx) => {
      const session = await tx.session.create({
        data: {
          deviceId,
          guestId: booking.guestId,
          bookingId: booking.id,
          tariffId: booking.tariffId,
          source: "BOOKING",
          status: "ACTIVE",
          startedAt: new Date(),
          endsAt: booking.endAt,
        },
      });
      await tx.booking.update({ where: { id: booking.id }, data: { status: "ACTIVE" } });
      await tx.device.update({ where: { id: deviceId }, data: { status: "BUSY" } });
      return session;
    });
  }

  // Вход по логину/паролю без брони — гостю даётся окно на выбор и оплату
  // тарифа; если не успел, сессия помечается EXPIRED (перезагрузка — задача
  // станционного агента/HA, вне зоны ответственности этого backend).
  async startWalkIn(deviceId: string, guestId: string) {
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) throw new NotFoundError("Device", deviceId);
    if (device.status !== "FREE") {
      throw new DomainError("DEVICE_NOT_FREE", `Device ${deviceId} is ${device.status}`, 409);
    }

    return this.prisma.$transaction(async (tx) => {
      const session = await tx.session.create({
        data: {
          deviceId,
          guestId,
          source: "WALK_IN_LOGIN",
          status: "PENDING_PAYMENT",
          startedAt: new Date(),
          endsAt: new Date(Date.now() + WALK_IN_PAYMENT_WINDOW_MINUTES * 60000),
        },
      });
      await tx.device.update({ where: { id: deviceId }, data: { status: "CONNECTING" } });
      return session;
    });
  }

  async choosePlanForWalkIn(sessionId: string, body: ChoosePlanBody) {
    const session = await this.get(sessionId);
    if (session.status !== "PENDING_PAYMENT") {
      throw new DomainError("NOT_PENDING_PAYMENT", `Session ${sessionId} is ${session.status}`, 409);
    }
    if (new Date() > session.endsAt) {
      return this.expireWalkIn(sessionId);
    }

    const device = await this.prisma.device.findUniqueOrThrow({ where: { id: session.deviceId } });

    if (body.subscriptionId) {
      // Абонемент — время расходуется напрямую, без обращения к тарифной сетке.
      if (!body.durationMinutes) {
        throw new DomainError("MISSING_DURATION", "durationMinutes required for subscription use", 400);
      }
      return this.prisma.$transaction(async (tx) => {
        await this.tariffs.consumeSubscriptionMinutes(body.subscriptionId!, body.durationMinutes!, tx);
        return tx.session.update({
          where: { id: sessionId },
          data: {
            tariffId: body.tariffId,
            status: "ACTIVE",
            startedAt: new Date(),
            endsAt: new Date(Date.now() + body.durationMinutes! * 60000),
          },
        });
      });
    }

    const tariff = await this.tariffs.getTariff(body.tariffId);
    const quote = await this.tariffs.quote({
      tariffId: body.tariffId,
      zoneId: device.zoneId,
      startAt: new Date(),
      durationMinutes: body.durationMinutes,
    });
    const { discountPercent } = tariff.ignoreLoyaltyDiscounts
      ? { discountPercent: 0 }
      : await this.loyalty.getEffectiveLoyalty(session.guestId, device.clubId);
    const priceToCharge = quote.price.mul(100 - discountPercent).div(100);

    return this.prisma.$transaction(async (tx) => {
      await this.balance.applyDelta(tx, {
        guestId: session.guestId,
        kind: "MONEY",
        delta: priceToCharge.neg(),
        source: "SESSION_CHARGE",
        referenceType: "SESSION",
        referenceId: sessionId,
      });
      await this.loyalty.applyLoyaltyCashback(
        tx,
        session.guestId,
        device.clubId,
        priceToCharge,
        tariff.ignoreLoyaltyDiscounts,
        sessionId,
      );
      await tx.device.update({ where: { id: session.deviceId }, data: { status: "BUSY" } });
      return tx.session.update({
        where: { id: sessionId },
        data: {
          tariffId: body.tariffId,
          status: "ACTIVE",
          startedAt: new Date(),
          endsAt: new Date(Date.now() + quote.paidMinutes * 60000),
        },
      });
    });
  }

  async expireWalkIn(sessionId: string) {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.session.update({
        where: { id: sessionId },
        data: { status: "EXPIRED" },
      });
      await tx.device.update({ where: { id: session.deviceId }, data: { status: "FREE" } });
      return session;
    });
  }

  // Продление капается следующей бронью этого устройства минус 30 минут;
  // продление не сгорает при повторном вводе кода — endsAt всегда актуален,
  // история хранится в SessionExtension.
  async extend(sessionId: string, minutes: number) {
    const session = await this.get(sessionId);
    if (session.status !== "ACTIVE") {
      throw new DomainError("SESSION_NOT_ACTIVE", `Session ${sessionId} is ${session.status}`, 409);
    }

    const nextBooking = await this.prisma.booking.findFirst({
      where: {
        deviceId: session.deviceId,
        status: "SCHEDULED",
        startAt: { gt: session.endsAt },
      },
      orderBy: { startAt: "asc" },
    });

    const requestedNewEnd = new Date(session.endsAt.getTime() + minutes * 60000);
    const cappedEnd = capExtension(requestedNewEnd, nextBooking?.startAt ?? null);
    const actualMinutes = Math.floor((cappedEnd.getTime() - session.endsAt.getTime()) / 60000);

    if (actualMinutes <= 0) {
      throw new DomainError(
        "EXTENSION_BLOCKED",
        "Cannot extend — the next booking on this device starts too soon",
        409,
      );
    }

    let price = null;
    if (session.tariffId) {
      const device = await this.prisma.device.findUniqueOrThrow({ where: { id: session.deviceId } });
      const quote = await this.tariffs.quote({
        tariffId: session.tariffId,
        zoneId: device.zoneId,
        startAt: session.endsAt,
        durationMinutes: actualMinutes,
      });
      price = quote.price;
    }

    return this.prisma.$transaction(async (tx) => {
      if (price) {
        await this.balance.applyDelta(tx, {
          guestId: session.guestId,
          kind: "MONEY",
          delta: price.neg(),
          source: "SESSION_CHARGE",
          referenceType: "SESSION",
          referenceId: sessionId,
        });
      }

      await tx.sessionExtension.create({
        data: {
          sessionId,
          minutesAdded: actualMinutes,
          previousEnd: session.endsAt,
          newEnd: cappedEnd,
        },
      });

      return tx.session.update({ where: { id: sessionId }, data: { endsAt: cappedEnd } });
    });
  }

  async complete(sessionId: string) {
    const session = await this.get(sessionId);
    return this.prisma.$transaction(async (tx) => {
      const completed = await tx.session.update({
        where: { id: sessionId },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      await tx.device.update({ where: { id: session.deviceId }, data: { status: "FREE" } });
      if (session.bookingId) {
        await tx.booking.update({ where: { id: session.bookingId }, data: { status: "COMPLETED" } });
      }
      return completed;
    });
  }
}
