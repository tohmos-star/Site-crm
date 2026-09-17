import type { FastifyPluginAsync } from "fastify";
import { Type } from "@sinclair/typebox";
import {
  BulkStatusBody,
  DeviceBody,
  DeviceParams,
  DeviceStatus,
  SetStatusBody,
} from "./schemas.js";
import { DeviceService } from "./service.js";
import { StubMikrotikWolProvider } from "./wol.js";

const deviceRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new DeviceService(fastify.prisma, new StubMikrotikWolProvider());

  fastify.get("/devices", {
    schema: {
      querystring: Type.Object({
        clubId: Type.Optional(Type.String()),
        zoneId: Type.Optional(Type.String()),
        status: Type.Optional(DeviceStatus),
      }),
    },
    handler: async (request) => service.list(request.query as never),
  });

  fastify.get("/devices/:id", {
    schema: { params: DeviceParams },
    handler: async (request) => service.get((request.params as { id: string }).id),
  });

  fastify.post("/devices", {
    schema: { body: DeviceBody },
    handler: async (request, reply) => {
      const device = await service.create(request.body as never);
      reply.code(201);
      return device;
    },
  });

  fastify.patch("/devices/:id", {
    schema: { params: DeviceParams, body: Type.Partial(DeviceBody) },
    handler: async (request) =>
      service.update((request.params as { id: string }).id, request.body as never),
  });

  fastify.delete("/devices/:id", {
    schema: { params: DeviceParams },
    handler: async (request, reply) => {
      await service.delete((request.params as { id: string }).id);
      reply.code(204);
    },
  });

  fastify.post("/devices/:id/status", {
    schema: { params: DeviceParams, body: SetStatusBody },
    handler: async (request) => {
      const { id } = request.params as { id: string };
      const { status } = request.body as { status: never };
      return service.setStatus(id, status);
    },
  });

  fastify.post("/devices/bulk-status", {
    schema: { body: BulkStatusBody },
    handler: async (request) => {
      const { deviceIds, status } = request.body as { deviceIds: string[]; status: never };
      return service.bulkSetStatus(deviceIds, status);
    },
  });

  fastify.post("/devices/:id/wake", {
    schema: { params: DeviceParams },
    handler: async (request, reply) => {
      await service.wakeUp((request.params as { id: string }).id);
      reply.code(202);
      return { ok: true };
    },
  });
};

export default deviceRoutes;
