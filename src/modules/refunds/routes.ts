import type { FastifyPluginAsync } from "fastify";
import { Type } from "@sinclair/typebox";
import { CreateRefundBody, DecideRefundBody, IdParams } from "./schemas.js";
import { RefundService } from "./service.js";

const refundRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new RefundService(fastify.prisma);

  fastify.get("/refunds", {
    schema: { querystring: Type.Object({ guestId: Type.Optional(Type.String()) }) },
    handler: async (request) => service.list((request.query as { guestId?: string }).guestId),
  });

  fastify.get("/refunds/:id", {
    schema: { params: IdParams },
    handler: async (request) => service.get((request.params as { id: string }).id),
  });

  fastify.post("/refunds", {
    schema: { body: CreateRefundBody },
    handler: async (request, reply) => {
      reply.code(201);
      return service.create(request.body as never);
    },
  });

  fastify.post("/refunds/:id/decide", {
    schema: { params: IdParams, body: DecideRefundBody },
    handler: async (request) =>
      service.decide((request.params as { id: string }).id, request.body as never),
  });

  fastify.post("/refunds/:id/complete", {
    schema: { params: IdParams },
    handler: async (request) => service.complete((request.params as { id: string }).id),
  });
};

export default refundRoutes;
