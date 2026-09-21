import type { PrismaClient } from "@prisma/client";
import { DomainError, NotFoundError } from "../../lib/errors.js";
import { BookingService } from "../bookings/booking.service.js";
import { TariffService } from "../tariffs/service.js";
import { BalanceService } from "../balance/service.js";

// booking.js хочет {required, available} в теле 402 — не общий {code,
// message} остальных ошибок. Обычный Error (не DomainError) специально:
// routes.ts ловит именно этот класс и сам строит тело ответа, а не общий
// errorHandler в app.ts.
export class InsufficientBalanceFacadeError extends Error {
  constructor(
    public readonly required: number,
    public readonly available: number,
  ) {
    super(`Insufficient balance: required ${required}, available ${available}`);
  }
}

// Façade поверх реального домена (Device/Zone/Tariff/Booking) под форму,
// которую уже ждут frontend/js/booking.js и android GuestRepository —
// {id, room, seat, label, tariffPerHour} вместо явного выбора тарифа/зоны.
export class AppFacadeService {
  private readonly bookings: BookingService;
  private readonly tariffs: TariffService;
  private readonly balance: BalanceService;

  constructor(private readonly prisma: PrismaClient) {
    this.bookings = new BookingService(prisma);
    this.tariffs = new TariffService(prisma);
    this.balance = new BalanceService(prisma);
  }

  async listStations() {
    const devices = await this.prisma.device.findMany({
      where: { kind: "PC" },
      include: { zone: true },
      orderBy: [{ zoneId: "asc" }, { cardNumber: "asc" }],
    });

    // seat — номер места внутри своей зоны (не глобальный cardNumber), как
    // и ожидалось раньше клиентами (Android FloorPlan, старый демо-фронт).
    const seatByZone = new Map<string, number>();
    const stations = [];
    for (const device of devices) {
      const seat = (seatByZone.get(device.zoneId) ?? 0) + 1;
      seatByZone.set(device.zoneId, seat);

      let tariffPerHour = 0;
      if (device.zone.defaultTariffId) {
        const quote = await this.tariffs.quote({
          tariffId: device.zone.defaultTariffId,
          zoneId: device.zoneId,
          startAt: new Date(),
          durationMinutes: 60,
        });
        tariffPerHour = Math.round(Number(quote.price));
      }

      stations.push({
        id: device.id,
        room: device.zoneId,
        roomLabel: device.zone.nameRu,
        seat,
        label: device.name,
        tariffPerHour,
        status: device.status,
      });
    }
    return stations;
  }

  async myBookings(guestId: string) {
    const bookings = await this.prisma.booking.findMany({
      where: { guestId, status: { in: ["SCHEDULED", "ACTIVE"] } },
      include: { device: true },
      orderBy: { startAt: "asc" },
    });
    return Promise.all(
      bookings.map(async (b) => ({
        id: b.id,
        station: { label: b.device.name },
        code: b.code,
        startAt: b.startAt,
        minutesPaid: b.paidMinutes,
        amountRub: await this.chargedAmount(b.id),
      })),
    );
  }

  async createBooking(guestId: string, stationId: string, startAt: string, minutes: number) {
    const device = await this.prisma.device.findUnique({ where: { id: stationId }, include: { zone: true } });
    if (!device) throw new NotFoundError("Device", stationId);
    if (!device.zone.defaultTariffId) {
      throw new DomainError(
        "NO_DEFAULT_TARIFF",
        "У зоны этого места не настроен тариф для быстрой брони — обратитесь к администратору",
        500,
      );
    }

    // Проверяем баланс здесь, а не ловим InsufficientBalanceError из
    // domain — тому неоткуда взять аккуратные {required, available},
    // только текст сообщения.
    const quote = await this.tariffs.quote({
      tariffId: device.zone.defaultTariffId,
      zoneId: device.zoneId,
      startAt: new Date(startAt),
      durationMinutes: minutes,
    });
    const available = Number(await this.balance.getBalance(guestId, "MONEY"));
    const required = Math.round(Number(quote.price));
    if (available < required) {
      throw new InsufficientBalanceFacadeError(required, available);
    }

    try {
      const booking = await this.bookings.create({
        deviceId: stationId,
        guestId,
        tariffId: device.zone.defaultTariffId,
        startAt,
        durationMinutes: minutes,
      });
      return { code: booking.code, id: booking.id };
    } catch (error) {
      throw this.remapLeadTimeError(error);
    }
  }

  async cancelBooking(guestId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundError("Booking", bookingId);
    if (booking.guestId !== guestId) {
      throw new DomainError("FORBIDDEN", "Эта бронь принадлежит другому гостю", 403);
    }
    await this.bookings.cancel(bookingId);
    return { refunded: true };
  }

  private async chargedAmount(bookingId: string): Promise<number> {
    const entry = await this.prisma.balanceLedger.findFirst({
      where: { referenceType: "BOOKING", referenceId: bookingId, source: "SESSION_CHARGE" },
    });
    return entry ? Math.round(Number(entry.amountDelta) * -1) : 0;
  }

  // Реальный домен не различает "нельзя раньше 5 минут" и "нужен зазор с
  // соседней бронью" по статус-коду — оба через BookingConflictError (409).
  // frontend/js/booking.js хочет первое как 400 с конкретным текстом —
  // переводим здесь, а не меняем семантику домена ради одного фронта.
  private remapLeadTimeError(error: unknown) {
    if (error instanceof DomainError && error.code === "BOOKING_CONFLICT" && error.message.includes("minutes from now")) {
      return new DomainError("BOOKING_CONFLICT", error.message, 400);
    }
    return error;
  }
}
