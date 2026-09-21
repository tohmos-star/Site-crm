import type { FastifyPluginAsync } from "fastify";
import {
  ExtendSessionBody,
  GuestRefundRequestBody,
  GuestTopUpBody,
  QuoteBody,
  SessionIdParams,
  StartWalkInSessionBody,
} from "./schemas.js";
import { GuestSelfServiceService } from "./service.js";

// Гостевые ручки, которых раньше не было в API вообще (только admin-JWT или
// device-токен станции) — см. коммит, добавивший этот модуль, и
// AskUserQuestion в истории сессии про Android-приложение.
const guestSelfServiceRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new GuestSelfServiceService(fastify.prisma);

  // Публично — как /api/stations: статичный каталог без данных гостя,
  // приложение показывает его ещё до логина (экран "почему стоит вступить").
  fastify.get("/loyalty-tiers", async () => {
    return service.listLoyaltyTiers();
  });

  // Всё остальное — только под гостевым JWT, с guestId из токена (никогда
  // из тела запроса) и проверкой владения там, где раньше её не было вообще
  // (SessionService не проверял guestId — только pcAgent проверял deviceId).
  await fastify.register(async (guestScope) => {
    guestScope.addHook("preHandler", guestScope.authenticateGuest);

    guestScope.post("/bookings/quote", {
      schema: { body: QuoteBody },
      handler: async (request) => {
        const { stationId, minutes, startAt } = request.body as QuoteBody;
        return service.quoteBooking(request.guestId!, stationId, minutes, startAt);
      },
    });

    guestScope.post("/sessions", {
      schema: { body: StartWalkInSessionBody },
      handler: async (request, reply) => {
        const { stationId, minutes } = request.body as StartWalkInSessionBody;
        reply.code(201);
        return service.startWalkInSession(request.guestId!, stationId, minutes);
      },
    });

    guestScope.get("/sessions/active", async (request) => {
      const session = await service.activeSession(request.guestId!);
      return { session };
    });

    guestScope.post("/sessions/:id/extend", {
      schema: { params: SessionIdParams, body: ExtendSessionBody },
      handler: async (request) => {
        const { id } = request.params as { id: string };
        const { minutes } = request.body as { minutes: number };
        return service.extendSession(request.guestId!, id, minutes);
      },
    });

    guestScope.post("/topup", {
      schema: { body: GuestTopUpBody },
      handler: async (request, reply) => {
        const { amount } = request.body as GuestTopUpBody;
        reply.code(201);
        return service.topUp(request.guestId!, amount);
      },
    });

    guestScope.post("/refund-requests", {
      schema: { body: GuestRefundRequestBody },
      handler: async (request, reply) => {
        const { amount, reason } = request.body as GuestRefundRequestBody;
        reply.code(201);
        return service.requestRefund(request.guestId!, amount, reason);
      },
    });

    guestScope.get("/refund-requests", async (request) => {
      return service.myRefundRequests(request.guestId!);
    });
  });
};

export default guestSelfServiceRoutes;
