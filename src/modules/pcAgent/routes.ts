import type { FastifyPluginAsync } from "fastify";
import { ExtendSessionBody, RedeemCodeBody, SessionIdParams } from "./schemas.js";
import { PcAgentService } from "./service.js";

const pcAgentRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new PcAgentService(fastify.prisma);

  fastify.addHook("preHandler", fastify.authenticateDevice);

  fastify.post("/pc/redeem-code", {
    schema: { body: RedeemCodeBody },
    handler: async (request, reply) => {
      const { code } = request.body as { code: string };
      reply.code(201);
      return service.redeemCode(request.deviceId!, code);
    },
  });

  fastify.get("/pc/session", async (request) => {
    const session = await service.currentSession(request.deviceId!);
    return { session };
  });

  fastify.post("/pc/session/:id/extend", {
    schema: { params: SessionIdParams, body: ExtendSessionBody },
    handler: async (request) => {
      const { id } = request.params as { id: string };
      const { minutes } = request.body as { minutes: number };
      return service.extend(request.deviceId!, id, minutes);
    },
  });

  fastify.post("/pc/session/:id/complete", {
    schema: { params: SessionIdParams },
    handler: async (request) => {
      const { id } = request.params as { id: string };
      return service.complete(request.deviceId!, id);
    },
  });
};

export default pcAgentRoutes;
