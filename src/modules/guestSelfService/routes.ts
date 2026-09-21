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

// Гостевые ручки под authenticateGuest, которых раньше не было в API вообще
// (только admin-JWT или device-токен станции) — см. коммит, добавивший этот
// модуль, и AskUserQuestion в истории сессии про Android-приложение.
const guestSelfServiceRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new GuestSelfServiceService(fastify.prisma);

  fastify.addHook("preHandler", fastify.authenticateGuest);

  fastify.post("/bookings/quote", {
    schema: { body: QuoteBody },
    handler: async (request) => {
      const { stationId, minutes, startAt } = request.body as QuoteBody;
      return service.quoteBooking(request.guestId!, stationId, minutes, startAt);
    },
  });

  fastify.post("/sessions", {
    schema: { body: StartWalkInSessionBody },
    handler: async (request, reply) => {
      const { stationId, minutes } = request.body as StartWalkInSessionBody;
      reply.code(201);
      return service.startWalkInSession(request.guestId!, stationId, minutes);
    },
  });

  fastify.get("/sessions/active", async (request) => {
    const session = await service.activeSession(request.guestId!);
    return { session };
  });

  fastify.post("/sessions/:id/extend", {
    schema: { params: SessionIdParams, body: ExtendSessionBody },
    handler: async (request) => {
      const { id } = request.params as { id: string };
      const { minutes } = request.body as { minutes: number };
      return service.extendSession(request.guestId!, id, minutes);
    },
  });

  fastify.post("/topup", {
    schema: { body: GuestTopUpBody },
    handler: async (request, reply) => {
      const { amount } = request.body as GuestTopUpBody;
      reply.code(201);
      return service.topUp(request.guestId!, amount);
    },
  });

  fastify.post("/refund-requests", {
    schema: { body: GuestRefundRequestBody },
    handler: async (request, reply) => {
      const { amount, reason } = request.body as GuestRefundRequestBody;
      reply.code(201);
      return service.requestRefund(request.guestId!, amount, reason);
    },
  });

  fastify.get("/refund-requests", async (request) => {
    return service.myRefundRequests(request.guestId!);
  });

  fastify.get("/loyalty-tiers", async () => {
    return service.listLoyaltyTiers();
  });
};

export default guestSelfServiceRoutes;
