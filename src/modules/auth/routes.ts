import type { FastifyPluginAsync } from "fastify";
import { Type } from "@sinclair/typebox";
import {
  AccessCredentialBody,
  AdminLoginBody,
  LoginBody,
  RegistrationsQuery,
  ReviewRegistrationBody,
} from "./schemas.js";
import { AuthService, LoginStatusError } from "./service.js";
import { saveUploadedImage, UploadError } from "../../lib/uploads.js";
import { DomainError } from "../../lib/errors.js";

const authRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new AuthService(fastify.prisma, fastify);

  // -- Публичное --------------------------------------------------------

  fastify.get("/status", async () => {
    const club = await service.getSingleClub();
    const devices = await fastify.prisma.device.findMany({
      where: { clubId: club.id, kind: "PC" },
      select: { status: true },
    });
    return {
      open: true, // клуб круглосуточный (см. android/ClubInfoScreen) — follow-up: расписание
      free: devices.filter((d) => d.status === "FREE").length,
      total: devices.length,
    };
  });

  // Как frontend/register.js: multipart {phone, password, fio, document, selfie}.
  fastify.post("/registrations", async (request, reply) => {
    const fields: Record<string, string> = {};
    let docPhotoPath: string | undefined;
    let selfiePhotoPath: string | undefined;

    try {
      for await (const part of request.parts()) {
        if (part.type === "file") {
          if (part.fieldname === "document") {
            docPhotoPath = await saveUploadedImage(part, "registrations");
          } else if (part.fieldname === "selfie") {
            selfiePhotoPath = await saveUploadedImage(part, "registrations");
          } else {
            await part.toBuffer(); // должны прочитать поток, даже если поле не нужно
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

    if (!fields.phone || !fields.password || !fields.fio) {
      throw new DomainError("VALIDATION_ERROR", "phone, password и fio обязательны", 400);
    }
    if (!docPhotoPath || !selfiePhotoPath) {
      throw new DomainError("VALIDATION_ERROR", "Нужны оба фото — документ и селфи", 400);
    }

    const guest = await service.register({
      phone: fields.phone,
      password: fields.password,
      fullName: fields.fio,
      docPhotoPath,
      selfiePhotoPath,
    });
    reply.code(201);
    return { id: guest.id, regStatus: guest.regStatus };
  });

  fastify.post("/auth/login", {
    schema: { body: LoginBody },
    handler: async (request, reply) => {
      const { phone, password } = request.body as { phone: string; password: string };
      try {
        const { token } = await service.login(phone, password);
        return { token };
      } catch (error) {
        if (error instanceof LoginStatusError) {
          reply.code(401);
          return { status: error.loginStatus };
        }
        throw error;
      }
    },
  });

  fastify.post("/auth/logout", async (_request, reply) => {
    // JWT — без состояния на сервере, клиент сам выбрасывает токен.
    reply.code(200);
    return { ok: true };
  });

  fastify.get("/auth/me", {
    preHandler: fastify.authenticateGuest,
    handler: async (request) => {
      const guest = await fastify.prisma.guest.findUniqueOrThrow({ where: { id: request.guestId! } });
      return {
        id: guest.id,
        phone: guest.phone,
        fio: guest.fullName,
        balanceRub: await service.guestBalanceRub(guest.id),
        bonusPoints: await service.guestBonusPoints(guest.id),
      };
    },
  });

  fastify.get("/entry-access", {
    preHandler: fastify.authenticateGuest,
    handler: async () => {
      const club = await service.getSingleClub();
      return { intercomUrl: club.intercomUrl ?? "", doorCodeMain: club.doorCodeMain ?? "" };
    },
  });

  // -- Админ --------------------------------------------------------------

  fastify.post("/admin/login", {
    schema: { body: AdminLoginBody },
    handler: async (request) => {
      const { email, password } = request.body as { email: string; password: string };
      const { token } = await service.adminLogin(email, password);
      return { token };
    },
  });

  fastify.post("/admin/logout", {
    preHandler: fastify.authenticateAdmin,
    handler: async (_request, reply) => {
      reply.code(200);
      return { ok: true };
    },
  });

  fastify.get("/admin/registrations", {
    preHandler: fastify.authenticateAdmin,
    schema: { querystring: RegistrationsQuery },
    handler: async (request) => {
      const raw = (request.query as { status?: string }).status ?? "pending";
      const status = raw.toUpperCase() as "PENDING" | "APPROVED" | "REJECTED";
      const guests = await service.listRegistrations(status);
      return guests.map((g) => ({
        id: g.id,
        guest: { phone: g.phone, fio: g.fullName },
        submittedAt: g.createdAt,
        documentPhotoUrl: g.docPhotoPath ? `/uploads/${g.docPhotoPath}` : null,
        selfiePhotoUrl: g.selfiePhotoPath ? `/uploads/${g.selfiePhotoPath}` : null,
        status: g.regStatus.toLowerCase(),
      }));
    },
  });

  fastify.post("/admin/registrations/:id/review", {
    preHandler: fastify.authenticateAdmin,
    schema: { params: Type.Object({ id: Type.String() }), body: ReviewRegistrationBody },
    handler: async (request) => {
      const { id } = request.params as { id: string };
      const { status } = request.body as { status: "approved" | "rejected" };
      const guest = await service.reviewRegistration(id, status);
      return { id: guest.id, status: guest.regStatus.toLowerCase() };
    },
  });

  fastify.get("/admin/access-credential", {
    preHandler: fastify.authenticateAdmin,
    handler: async () => {
      const club = await service.getSingleClub();
      return {
        intercomUrl: club.intercomUrl,
        doorCodeMain: club.doorCodeMain,
        doorCodeSecond: club.doorCodeSecond,
      };
    },
  });

  fastify.put("/admin/access-credential", {
    preHandler: fastify.authenticateAdmin,
    schema: { body: AccessCredentialBody },
    handler: async (request) => {
      const body = request.body as { intercomUrl: string; doorCodeMain: string; doorCodeSecond?: string };
      const club = await service.getSingleClub();
      const updated = await fastify.prisma.club.update({
        where: { id: club.id },
        data: {
          intercomUrl: body.intercomUrl,
          doorCodeMain: body.doorCodeMain,
          doorCodeSecond: body.doorCodeSecond ?? null,
        },
      });
      return {
        intercomUrl: updated.intercomUrl,
        doorCodeMain: updated.doorCodeMain,
        doorCodeSecond: updated.doorCodeSecond,
      };
    },
  });
};

export default authRoutes;
