import { Prisma, type PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { DomainError, NotFoundError } from "../../lib/errors.js";
import { BalanceService } from "../balance/service.js";
import { TariffService } from "../tariffs/service.js";
import { LoyaltyService } from "../loyalty/service.js";
import { StubMikrotikWolProvider } from "../devices/wol.js";
import { assertLeadTime, assertNoConflict, generateBookingCode } from "./rules.js";
import type { CreateBookingBody } from "./schemas.js";

const CODE_GENERATION_ATTEMPTS = 5;

export class BookingService {
  private readonly balance: BalanceService;
  private readonly tariffs: TariffService;
  private readonly loyalty: LoyaltyService;
  private readonly wol = new StubMikrotikWolProvider();

  constructor(private readonly prisma: PrismaClient) {
    this.balance = new BalanceService(prisma);
    this.tariffs = new TariffService(prisma);
    this.loyalty = new LoyaltyService(prisma);
  }

  async get(id: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundError("Booking", id);
    return booking;
  }

  list(deviceId?: string) {
    return this.prisma.booking.findMany({
      where: deviceId ? { deviceId } : undefined,
      orderBy: { startAt: "asc" },
    });
  }

  async create(input: CreateBookingBody) {
    const device = await this.prisma.device.findUnique({ where: { id: input.deviceId } });
    if (!device) throw new NotFoundError("Device", input.deviceId);

    const tariff = await this.tariffs.getTariff(input.tariffId);
    if (!tariff.allowOnlineBooking) {
      throw new DomainError(
        "TARIFF_NOT_BOOKABLE",
        `Tariff ${tariff.id} cannot be used for online booking`,
        400,
      );
    }

    const startAt = new Date(input.startAt);
    assertLeadTime(new Date(), startAt);

    const quote = await this.tariffs.quote({
      tariffId: input.tariffId,
      zoneId: device.zoneId,
      startAt,
      durationMinutes: input.durationMinutes,
    });
    const endAt = new Date(startAt.getTime() + quote.paidMinutes * 60000);

    const existing = await this.prisma.booking.findMany({
      where: { deviceId: input.deviceId, status: { in: ["SCHEDULED", "ACTIVE"] } },
      select: { id: true, startAt: true, endAt: true },
    });
    assertNoConflict(existing, startAt, endAt);

    const { discountPercent } = tariff.ignoreLoyaltyDiscounts
      ? { discountPercent: 0 }
      : await this.loyalty.getEffectiveLoyalty(input.guestId, device.clubId);
    const priceToCharge = quote.price.mul(100 - discountPercent).div(100);

    return this.prisma.$transaction(async (tx) => {
      const code = await this.generateUniqueCode(tx);
      const booking = await tx.booking.create({
        data: {
          deviceId: input.deviceId,
          guestId: input.guestId,
          tariffId: input.tariffId,
          code,
          startAt,
          paidMinutes: quote.paidMinutes,
          endAt,
          status: "SCHEDULED",
        },
      });

      await this.balance.applyDelta(tx, {
        guestId: input.guestId,
        kind: "MONEY",
        delta: priceToCharge.neg(),
        source: "SESSION_CHARGE",
        referenceType: "BOOKING",
        referenceId: booking.id,
      });

      await this.loyalty.applyLoyaltyCashback(
        tx,
        input.guestId,
        device.clubId,
        priceToCharge,
        tariff.ignoreLoyaltyDiscounts,
        booking.id,
      );

      return booking;
    });
  }

  async cancel(id: string) {
    const booking = await this.get(id);
    if (booking.status !== "SCHEDULED") {
      throw new DomainError(
        "CANNOT_CANCEL",
        `Booking ${id} in status ${booking.status} cannot be cancelled`,
        409,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const cancelled = await tx.booking.update({
        where: { id },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });

      // Полный возврат оплаченного окна при отмене (возврат неиспользованного
      // времени за отменённую — ещё не начавшуюся — бронь).
      const quote = await this.tariffs.quote({
        tariffId: booking.tariffId,
        zoneId: (await this.prisma.device.findUniqueOrThrow({ where: { id: booking.deviceId } }))
          .zoneId,
        startAt: booking.startAt,
        durationMinutes: booking.paidMinutes,
      });

      await this.balance.applyDelta(tx, {
        guestId: booking.guestId,
        kind: "MONEY",
        delta: quote.price,
        source: "REFUND",
        referenceType: "BOOKING",
        referenceId: booking.id,
      });

      return cancelled;
    });
  }

  // Вызывается плановой джобой (BullMQ, не реализовано в v1) за 5 минут до
  // startAt — включает устройство через MikroTik WOL, как в согласованном решении.
  async prepareDeviceForStart(bookingId: string) {
    const booking = await this.get(bookingId);
    const device = await this.prisma.device.findUniqueOrThrow({ where: { id: booking.deviceId } });
    if (device.mac) {
      await this.wol.wake(device.mac);
    }
  }

  private async generateUniqueCode(tx: Prisma.TransactionClient): Promise<string> {
    for (let attempt = 0; attempt < CODE_GENERATION_ATTEMPTS; attempt++) {
      const code = generateBookingCode();
      const clash = await tx.booking.findUnique({ where: { code } });
      if (!clash) return code;
    }
    throw new DomainError("CODE_GENERATION_FAILED", "Could not generate a unique booking code", 500);
  }
}
