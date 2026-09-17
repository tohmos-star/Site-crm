import type { FastifyPluginAsync } from "fastify";
import { Type } from "@sinclair/typebox";
import { IdParams, TopUpBody } from "./schemas.js";
import { PaymentService } from "./service.js";

const paymentRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new PaymentService(fastify.prisma);

  fastify.get("/payments", {
    schema: { querystring: Type.Object({ guestId: Type.Optional(Type.String()) }) },
    handler: async (request) => service.list((request.query as { guestId?: string }).guestId),
  });

  fastify.get("/payments/:id", {
    schema: { params: IdParams },
    handler: async (request) => service.get((request.params as { id: string }).id),
  });

  fastify.post("/payments/topup", {
    schema: { body: TopUpBody },
    handler: async (request, reply) => {
      reply.code(201);
      return service.topUp(request.body as never);
    },
  });
};

export default paymentRoutes;
