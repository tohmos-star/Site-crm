import type { PrismaClient } from "@prisma/client";
import { DomainError, ForbiddenError, NotFoundError } from "../../lib/errors.js";
import { SessionService } from "../bookings/session.service.js";
import { TariffService } from "../tariffs/service.js";

// Façade для pc-widget.html — авторизация по device-токену станции (см.
// authenticateDevice в src/plugins/auth.ts), не по гостевому JWT. Гость на
// станции ничего не логинит — код брони это разовый предъявитель для
// конкретного deviceId.
export class PcAgentService {
  private readonly sessions: SessionService;
  private readonly tariffs: TariffService;

  constructor(private readonly prisma: PrismaClient) {
    this.sessions = new SessionService(prisma);
    this.tariffs = new TariffService(prisma);
  }

  async redeemCode(deviceId: string, code: string) {
    const booking = await this.prisma.booking.findUnique({ where: { code } });
    if (!booking || booking.deviceId !== deviceId) {
      throw new DomainError("INVALID_CODE", "Код не найден или уже использован", 404);
    }
    const session = await this.sessions.activateFromBooking(code, deviceId);
    return this.describeSession(session.id);
  }

  async currentSession(deviceId: string) {
    const session = await this.prisma.session.findFirst({
      where: { deviceId, status: { in: ["ACTIVE", "PENDING_PAYMENT"] } },
      orderBy: { startedAt: "desc" },
    });
    if (!session) return null;
    return this.describeSession(session.id);
  }

  async extend(deviceId: string, sessionId: string, minutes: number) {
    await this.assertOwnedByDevice(deviceId, sessionId);
    await this.sessions.extend(sessionId, minutes);
    return this.describeSession(sessionId);
  }

  async complete(deviceId: string, sessionId: string) {
    await this.assertOwnedByDevice(deviceId, sessionId);
    await this.sessions.complete(sessionId);
    return { ok: true };
  }

  private async assertOwnedByDevice(deviceId: string, sessionId: string) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundError("Session", sessionId);
    if (session.deviceId !== deviceId) {
      throw new ForbiddenError("Эта сессия принадлежит другой станции");
    }
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

    return {
      id: session.id,
      status: session.status,
      stationLabel: session.device.name,
      endsAt: session.endsAt,
      tariffPerHour,
    };
  }
}
