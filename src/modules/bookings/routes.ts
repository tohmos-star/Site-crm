import type { FastifyPluginAsync } from "fastify";
import { Type } from "@sinclair/typebox";
import {
  ActivateBody,
  ChoosePlanBody,
  CreateBookingBody,
  ExtendBody,
  IdParams,
  StartWalkInBody,
} from "./schemas.js";
import { BookingService } from "./booking.service.js";
import { SessionService } from "./session.service.js";

const bookingRoutes: FastifyPluginAsync = async (fastify) => {
  const bookings = new BookingService(fastify.prisma);
  const sessions = new SessionService(fastify.prisma);

  fastify.get("/bookings", {
    schema: { querystring: Type.Object({ deviceId: Type.Optional(Type.String()) }) },
    handler: async (request) => bookings.list((request.query as { deviceId?: string }).deviceId),
  });

  fastify.get("/bookings/:id", {
    schema: { params: IdParams },
    handler: async (request) => bookings.get((request.params as { id: string }).id),
  });

  fastify.post("/bookings", {
    schema: { body: CreateBookingBody },
    handler: async (request, reply) => {
      reply.code(201);
      return bookings.create(request.body as never);
    },
  });

  fastify.post("/bookings/:id/cancel", {
    schema: { params: IdParams },
    handler: async (request) => bookings.cancel((request.params as { id: string }).id),
  });

  // Полноэкранный экран ввода кода на станции.
  fastify.post("/sessions/activate", {
    schema: { body: ActivateBody },
    handler: async (request, reply) => {
      const { code, deviceId } = request.body as { code: string; deviceId: string };
      reply.code(201);
      return sessions.activateFromBooking(code, deviceId);
    },
  });

  fastify.post("/sessions/walk-in", {
    schema: { body: StartWalkInBody },
    handler: async (request, reply) => {
      const { deviceId, guestId } = request.body as { deviceId: string; guestId: string };
      reply.code(201);
      return sessions.startWalkIn(deviceId, guestId);
    },
  });

  fastify.post("/sessions/:id/choose-plan", {
    schema: { params: IdParams, body: ChoosePlanBody },
    handler: async (request) =>
      sessions.choosePlanForWalkIn((request.params as { id: string }).id, request.body as never),
  });

  fastify.post("/sessions/:id/extend", {
    schema: { params: IdParams, body: ExtendBody },
    handler: async (request) => {
      const { id } = request.params as { id: string };
      const { minutes } = request.body as { minutes: number };
      return sessions.extend(id, minutes);
    },
  });

  fastify.post("/sessions/:id/complete", {
    schema: { params: IdParams },
    handler: async (request) => sessions.complete((request.params as { id: string }).id),
  });

  fastify.get("/sessions/:id", {
    schema: { params: IdParams },
    handler: async (request) => sessions.get((request.params as { id: string }).id),
  });
};

export default bookingRoutes;
