import type { FastifyPluginAsync } from "fastify";
import { Type } from "@sinclair/typebox";
import { BalanceKind, IdParams, ManualAdjustBody } from "./schemas.js";
import { BalanceService } from "./service.js";

const balanceRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new BalanceService(fastify.prisma);

  fastify.get("/guests/:id/balance", {
    schema: {
      params: IdParams,
      querystring: Type.Object({ kind: Type.Optional(BalanceKind) }),
    },
    handler: async (request) => {
      const { id } = request.params as { id: string };
      const { kind } = request.query as { kind?: "MONEY" | "BONUS" };
      if (kind) {
        return { kind, balance: await service.getBalance(id, kind) };
      }
      const [money, bonus] = await Promise.all([
        service.getBalance(id, "MONEY"),
        service.getBalance(id, "BONUS"),
      ]);
      return { money, bonus };
    },
  });

  fastify.get("/guests/:id/balance/history", {
    schema: {
      params: IdParams,
      querystring: Type.Object({ kind: Type.Optional(BalanceKind) }),
    },
    handler: async (request) => {
      const { id } = request.params as { id: string };
      const { kind } = request.query as { kind?: "MONEY" | "BONUS" };
      return service.history(id, kind);
    },
  });

  fastify.post("/guests/:id/balance/manual-adjust", {
    schema: { params: IdParams, body: ManualAdjustBody },
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as {
        kind: "MONEY" | "BONUS";
        delta: number;
        sourceChannel: "ADMIN_CONSOLE" | "BONUS_CONSOLE" | "GUEST_BALANCE_PAGE" | "API";
        staffId?: string;
        comment?: string;
      };
      const result = await service.manualAdjust({ guestId: id, ...body });
      reply.code(201);
      return result;
    },
  });
};

export default balanceRoutes;
