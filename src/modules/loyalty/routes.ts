import type { FastifyPluginAsync } from "fastify";
import { Type } from "@sinclair/typebox";
import {
  AutoBonusRuleBody,
  GuestIdParams,
  GuestManualGroupBody,
  IdParams,
  LoyaltySettingsBody,
  LoyaltyTierBody,
  SetManualGroupBody,
  SetTierBody,
} from "./schemas.js";
import { LoyaltyService } from "./service.js";

const loyaltyRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new LoyaltyService(fastify.prisma);

  fastify.get("/loyalty/tiers", { handler: async () => service.listTiers() });
  fastify.post("/loyalty/tiers", {
    schema: { body: LoyaltyTierBody },
    handler: async (request, reply) => {
      reply.code(201);
      return service.createTier(request.body as never);
    },
  });

  fastify.get("/loyalty/manual-groups", { handler: async () => service.listManualGroups() });
  fastify.post("/loyalty/manual-groups", {
    schema: { body: GuestManualGroupBody },
    handler: async (request, reply) => {
      reply.code(201);
      return service.createManualGroup(request.body as never);
    },
  });

  fastify.put("/loyalty/settings", {
    schema: { body: LoyaltySettingsBody },
    handler: async (request) => service.upsertSettings(request.body as never),
  });

  fastify.get("/loyalty/auto-bonus-rules", { handler: async () => service.listAutoBonusRules() });
  fastify.post("/loyalty/auto-bonus-rules", {
    schema: { body: AutoBonusRuleBody },
    handler: async (request, reply) => {
      reply.code(201);
      return service.createAutoBonusRule(request.body as never);
    },
  });
  fastify.delete("/loyalty/auto-bonus-rules/:id", {
    schema: { params: IdParams },
    handler: async (request, reply) => {
      await service.deleteAutoBonusRule((request.params as { id: string }).id);
      reply.code(204);
    },
  });

  fastify.get("/guests/:guestId/loyalty", {
    schema: {
      params: GuestIdParams,
      querystring: Type.Object({ clubId: Type.String() }),
    },
    handler: async (request) => {
      const { guestId } = request.params as { guestId: string };
      const { clubId } = request.query as { clubId: string };
      return service.getEffectiveLoyalty(guestId, clubId);
    },
  });

  fastify.post("/guests/:guestId/loyalty/recalculate", {
    schema: { params: GuestIdParams },
    handler: async (request) =>
      service.recalcGuestTier((request.params as { guestId: string }).guestId),
  });

  fastify.put("/guests/:guestId/manual-group", {
    schema: { params: GuestIdParams, body: SetManualGroupBody },
    handler: async (request) => {
      const { guestId } = request.params as { guestId: string };
      const { manualGroupId } = request.body as { manualGroupId: string | null };
      return service.setManualGroup(guestId, manualGroupId);
    },
  });

  fastify.put("/guests/:guestId/tier", {
    schema: { params: GuestIdParams, body: SetTierBody },
    handler: async (request) => {
      const { guestId } = request.params as { guestId: string };
      const { tierId } = request.body as { tierId: string | null };
      return service.setTier(guestId, tierId);
    },
  });

  fastify.post("/guests/:guestId/loyalty/birthday-bonus", {
    schema: {
      params: GuestIdParams,
      body: Type.Object({ clubId: Type.String() }),
    },
    handler: async (request) => {
      const { guestId } = request.params as { guestId: string };
      const { clubId } = request.body as { clubId: string };
      return service.applyBirthdayBonusIfDue(guestId, clubId);
    },
  });
};

export default loyaltyRoutes;
