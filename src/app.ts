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
import appFacadeRoutes from "./modules/appFacade/routes.js";
import pcAgentRoutes from "./modules/pcAgent/routes.js";
import sessionReportsRoutes from "./modules/sessionReports/routes.js";
import guestSelfServiceRoutes from "./modules/guestSelfService/routes.js";

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

  // Сам сайт (frontend/) — статика на корне. Реальные страницы уже
  // используют относительные от корня пути (/login.html, /js/layout.js,
  // /css/main.css) — раздаём как есть, роутер отдаёт /api и /uploads в
  // приоритете перед статическим fallback'ом.
  await app.register(fastifyStatic, {
    root: path.resolve(process.cwd(), "frontend"),
    prefix: "/",
    decorateReply: false,
  });

  app.get("/health", async () => ({ ok: true }));

  // Публичное + auth (регистрация/логин гостя и админа, entry-access,
  // /api/status) — см. src/modules/auth/routes.ts.
  await app.register(authRoutes, { prefix: "/api" });

  // Façade поверх Guest/BalanceLedger под конкретную форму frontend/admin/app.js.
  await app.register(adminGuestsRoutes, { prefix: "/api" });

  // Весь административный CRUD (зоны/устройства/тарифы/лояльность/возвраты/
  // клубы/сырые /guests/баланс, сырой bookings/sessions CRUD для ресепшена)
  // — только через админ-JWT. См. AskUserQuestion в истории сессии: "всё
  // администрирование через сайт". Сырой bookingRoutes живёт тут под
  // /api/admin/*, чтобы не конфликтовать по путям с гостевой façade ниже
  // (/api/bookings*) и ПК-агентом (/api/pc/*), которые бьют по тем же
  // сущностям с другой авторизацией.
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
      await adminScope.register(bookingRoutes, { prefix: "/admin" });
    },
    { prefix: "/api" },
  );

  // Гостевая façade "быстрая бронь" (см. Zone.defaultTariffId) поверх
  // реального Device/Booking-домена — под форму, которую уже ждут
  // frontend/js/booking.js и Android GuestRepository. Авторизация: гостевой
  // JWT (authenticateGuest внутри routes.ts), кроме GET /stations.
  await app.register(appFacadeRoutes, { prefix: "/api" });

  // Гостевые самообслуживание-ручки, которых не было в API вообще (quote,
  // walk-in сессия, extend, топап, запрос возврата, каталог лояльности) —
  // добавлены под Android-приложение, см. src/modules/guestSelfService.
  await app.register(guestSelfServiceRoutes, { prefix: "/api" });

  // ПК-виджет станции (pc-widget.html) — авторизация по device-токену
  // станции (authenticateDevice), не по гостевому JWT: гость на станции
  // ничего не логинит, только вводит код брони.
  await app.register(pcAgentRoutes, { prefix: "/api" });

  // Отчёт о чистоте места при завершении сессии (report.html) — публичный,
  // frontend/js/report.js не шлёт auth-заголовок; sessionId сам по себе
  // разовый предъявитель, как код брони.
  await app.register(sessionReportsRoutes, { prefix: "/api" });

  return app;
}
