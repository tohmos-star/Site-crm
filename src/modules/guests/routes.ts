import type { FastifyPluginAsync } from "fastify";
import { Type } from "@sinclair/typebox";
import { GuestBody, IdParams } from "./schemas.js";
import { GuestService } from "./service.js";

const guestRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new GuestService(fastify.prisma);

  fastify.get("/guests", {
    schema: { querystring: Type.Object({ search: Type.Optional(Type.String()) }) },
    handler: async (request) => service.list((request.query as { search?: string }).search),
  });

  fastify.get("/guests/:id", {
    schema: { params: IdParams },
    handler: async (request) => service.get((request.params as { id: string }).id),
  });

  fastify.post("/guests", {
    schema: { body: GuestBody },
    handler: async (request, reply) => {
      const guest = await service.create(request.body as never);
      reply.code(201);
      return guest;
    },
  });

  fastify.patch("/guests/:id", {
    schema: { params: IdParams, body: Type.Partial(GuestBody) },
    handler: async (request) =>
      service.update((request.params as { id: string }).id, request.body as never),
  });
};

export default guestRoutes;
