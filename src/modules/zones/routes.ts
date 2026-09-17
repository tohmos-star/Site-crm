import type { FastifyPluginAsync } from "fastify";
import { Type } from "@sinclair/typebox";
import { ZoneBody, ZoneParams } from "./schemas.js";
import { ZoneService } from "./service.js";

const zoneRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new ZoneService(fastify.prisma);

  fastify.get("/zones", {
    schema: { querystring: Type.Object({ clubId: Type.Optional(Type.String()) }) },
    handler: async (request) => {
      const { clubId } = request.query as { clubId?: string };
      return service.list(clubId);
    },
  });

  fastify.get("/zones/:id", {
    schema: { params: ZoneParams },
    handler: async (request) => service.get((request.params as { id: string }).id),
  });

  fastify.post("/zones", {
    schema: { body: ZoneBody },
    handler: async (request, reply) => {
      const zone = await service.create(request.body as never);
      reply.code(201);
      return zone;
    },
  });

  fastify.patch("/zones/:id", {
    schema: { params: ZoneParams, body: Type.Partial(ZoneBody) },
    handler: async (request) =>
      service.update((request.params as { id: string }).id, request.body as never),
  });

  fastify.delete("/zones/:id", {
    schema: { params: ZoneParams },
    handler: async (request, reply) => {
      await service.delete((request.params as { id: string }).id);
      reply.code(204);
    },
  });
};

export default zoneRoutes;
