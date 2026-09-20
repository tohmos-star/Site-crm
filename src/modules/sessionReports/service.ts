import type { PrismaClient } from "@prisma/client";
import { DomainError } from "../../lib/errors.js";
import { SessionService } from "../bookings/session.service.js";

export class SessionReportService {
  private readonly sessions: SessionService;

  constructor(private readonly prisma: PrismaClient) {
    this.sessions = new SessionService(prisma);
  }

  async submit(input: {
    sessionId: string;
    cleanDesk: boolean;
    cleanPc: boolean;
    cleanHeadset: boolean;
    photoPaths: string[];
  }) {
    const session = await this.prisma.session.findUnique({ where: { id: input.sessionId } });
    if (!session) {
      throw new DomainError("NOT_FOUND", "Session not found", 404);
    }
    if (session.status !== "ACTIVE") {
      throw new DomainError("SESSION_NOT_ACTIVE", `Session is ${session.status}`, 409);
    }

    return this.sessions.complete(input.sessionId, {
      cleanDesk: input.cleanDesk,
      cleanPc: input.cleanPc,
      cleanHeadset: input.cleanHeadset,
      photoPaths: input.photoPaths,
    });
  }
}
