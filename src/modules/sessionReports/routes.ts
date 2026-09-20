import type { FastifyPluginAsync } from "fastify";
import { saveUploadedImage, UploadError } from "../../lib/uploads.js";
import { DomainError } from "../../lib/errors.js";
import { SessionReportService } from "./service.js";

// frontend/js/report.js шлёт multipart без auth-заголовка (гость на станции
// нигде не логинится) — sessionId сам по себе разовый предъявитель, как код
// брони. {sessionId, checkDesk/checkPc/checkHeadset: 'true', photo_0,
// photo_1 (обязательны), photo_2 (опционально)}.
const sessionReportsRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new SessionReportService(fastify.prisma);

  fastify.post("/session-reports", async (request, reply) => {
    const fields: Record<string, string> = {};
    const photoPaths: string[] = [];

    try {
      for await (const part of request.parts()) {
        if (part.type === "file") {
          if (/^photo_\d+$/.test(part.fieldname)) {
            photoPaths.push(await saveUploadedImage(part, "session-reports"));
          } else {
            await part.toBuffer();
          }
        } else {
          fields[part.fieldname] = String(part.value);
        }
      }
    } catch (error) {
      if (error instanceof UploadError) {
        throw new DomainError("VALIDATION_ERROR", error.message, 400);
      }
      throw error;
    }

    if (!fields.sessionId) {
      throw new DomainError("VALIDATION_ERROR", "sessionId обязателен", 400);
    }
    if (photoPaths.length < 2) {
      throw new DomainError("VALIDATION_ERROR", "Нужны минимум 2 фото", 400);
    }

    const session = await service.submit({
      sessionId: fields.sessionId,
      cleanDesk: fields.checkDesk === "true",
      cleanPc: fields.checkPc === "true",
      cleanHeadset: fields.checkHeadset === "true",
      photoPaths,
    });

    reply.code(201);
    return { ok: true, sessionId: session.id };
  });
};

export default sessionReportsRoutes;
