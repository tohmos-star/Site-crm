import path from "node:path";
import Fastify from "fastify";
import fastifyMultipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { env } from "./config/env.js";
import prismaPlugin from "./plugins/prisma.js";
import authPlugin from "./plugins/auth.js";
import { DomainError } from "./lib/errors.js";
import { UPLOADS_ROOT } from "./lib/uploads.js";

import clubRoutes from "./modules/clubs/routes.js";
import zoneRoutes from "./modules/zones/routes.js";
import deviceRoutes from "./modules/devices/routes.js";
import tariffRoutes from "./modules/tariffs/routes.js";
import bookingRoutes from "./modules/bookings/routes.js";
import guestRoutes from "./modules/guests/routes.js";
import balanceRoutes from "./modules/balance/routes.js";
import loyaltyRoutes from "./modules/loyalty/routes.js";
import refundRoutes from "./modules/refunds/routes.js";
import paymentRoutes from "./modules/payments/routes.js";
import authRoutes from "./modules/auth/routes.js";
import adminGuestsRoutes from "./modules/adminGuests/routes.js";

export async function buildApp() {
  const app = Fastify({
    logger: { level: env.logLevel },
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof DomainError) {
      // И message (админ/raw-domain роуты), и error (frontend/js/*.js везде
      // читает data.error, не data.message) — проще отдавать оба ключа, чем
      // переписывать обработку ошибок в каждом файле фронтенда.
      reply.code(error.statusCode).send({ code: error.code, message: error.message, error: error.message });
      return;
    }
    const err = error as Error & { validation?: unknown };
    if (err.validation) {
      reply.code(400).send({ code: "VALIDATION_ERROR", message: err.message, error: err.message });
      return;
    }
    app.log.error(error);
    reply.code(500).send({ code: "INTERNAL_ERROR", message: "Internal server error" });
  });

  await app.register(prismaPlugin);
  await app.register(authPlugin);
  await app.register(fastifyMultipart, {
    limits: { fileSize: 8 * 1024 * 1024, files: 5 },
  });
  // Отданные фото (документ/селфи при регистрации, фото места при
  // завершении сессии) — see src/lib/uploads.ts. Только чтение, загрузка
  // всегда через конкретные ручки с проверкой типа/размера.
  await app.register(fastifyStatic, {
    root: path.resolve(UPLOADS_ROOT),
    prefix: "/uploads/",
    decorateReply: false,
  });

  app.get("/health", async () => ({ ok: true }));

  // Публичное + auth (регистрация/логин гостя и админа, entry-access,
  // /api/status) — см. src/modules/auth/routes.ts.
  await app.register(authRoutes, { prefix: "/api" });

  // Façade поверх Guest/BalanceLedger под конкретную форму frontend/admin/app.js.
  await app.register(adminGuestsRoutes, { prefix: "/api" });

  // Весь административный CRUD (зоны/устройства/тарифы/лояльность/возвраты/
  // клубы/сырые /guests/баланс) — только через админ-JWT. См. AskUserQuestion
  // в истории сессии: "всё администрирование через сайт".
  await app.register(
    async (adminScope) => {
      adminScope.addHook("preHandler", adminScope.authenticateAdmin);
      await adminScope.register(clubRoutes);
      await adminScope.register(zoneRoutes);
      await adminScope.register(deviceRoutes);
      await adminScope.register(tariffRoutes);
      await adminScope.register(guestRoutes);
      await adminScope.register(balanceRoutes);
      await adminScope.register(loyaltyRoutes);
      await adminScope.register(refundRoutes);
      await adminScope.register(paymentRoutes);
    },
    { prefix: "/api" },
  );

  // ВРЕМЕННО за admin-JWT: реальным вызывающим тут должны быть гость (JWT,
  // façade "быстрая бронь" — Increment 2) и ПК-агент (agentToken — Increment
  // 2, authenticateDevice уже есть в src/plugins/auth.ts). Пока эта проводка
  // не сделана, лучше держать финансовые ручки за каким-то auth, чем
  // полностью открытыми.
  await app.register(
    async (bookingScope) => {
      bookingScope.addHook("preHandler", bookingScope.authenticateAdmin);
      await bookingScope.register(bookingRoutes);
    },
    { prefix: "/api" },
  );

  return app;
}
