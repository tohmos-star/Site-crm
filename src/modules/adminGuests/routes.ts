import type { FastifyPluginAsync } from "fastify";
import { Type } from "@sinclair/typebox";
import { CreateGuestBody, GuestIdParams, UpdateGuestBody } from "./schemas.js";
import { AdminGuestsService } from "./service.js";

const adminGuestsRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new AdminGuestsService(fastify.prisma);

  fastify.addHook("preHandler", fastify.authenticateAdmin);

  fastify.get("/admin/guests", {
    schema: { querystring: Type.Object({ search: Type.Optional(Type.String()) }) },
    handler: async (request) => service.list((request.query as { search?: string }).search),
  });

  fastify.post("/admin/guests", {
    schema: { body: CreateGuestBody },
    handler: async (request, reply) => {
      reply.code(201);
      return service.create(request.body as never);
    },
  });

  fastify.put("/admin/guests/:id", {
    schema: { params: GuestIdParams, body: UpdateGuestBody },
    handler: async (request) => {
      const { id } = request.params as { id: string };
      return service.update(id, request.body as never);
    },
  });

  fastify.delete("/admin/guests/:id", {
    schema: { params: GuestIdParams },
    handler: async (request, reply) => {
      await service.remove((request.params as { id: string }).id);
      reply.code(204);
    },
  });
};

export default adminGuestsRoutes;
