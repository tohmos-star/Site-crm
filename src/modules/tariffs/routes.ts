import type { FastifyPluginAsync } from "fastify";
import { Type } from "@sinclair/typebox";
import {
  DayTypeBody,
  DayTypeParams,
  HolidayOverrideBody,
  IdParams,
  PurchaseSubscriptionBody,
  QuoteQuery,
  TariffBody,
  TariffGroupBody,
  TariffRuleBody,
} from "./schemas.js";
import { TariffService } from "./service.js";

const tariffRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new TariffService(fastify.prisma);

  fastify.get("/day-types", {
    schema: { querystring: Type.Object({ clubId: Type.Optional(Type.String()) }) },
    handler: async (request) => service.listDayTypes((request.query as { clubId?: string }).clubId),
  });
  fastify.post("/day-types", {
    schema: { body: DayTypeBody },
    handler: async (request, reply) => {
      reply.code(201);
      return service.createDayType(request.body as never);
    },
  });
  fastify.patch("/day-types/:id", {
    schema: { params: DayTypeParams, body: Type.Partial(DayTypeBody) },
    handler: async (request) =>
      service.updateDayType((request.params as { id: string }).id, request.body as never),
  });
  fastify.delete("/day-types/:id", {
    schema: { params: DayTypeParams },
    handler: async (request, reply) => {
      await service.deleteDayType((request.params as { id: string }).id);
      reply.code(204);
    },
  });

  fastify.get("/holiday-overrides", {
    schema: { querystring: Type.Object({ clubId: Type.Optional(Type.String()) }) },
    handler: async (request) =>
      service.listHolidayOverrides((request.query as { clubId?: string }).clubId),
  });
  fastify.post("/holiday-overrides", {
    schema: { body: HolidayOverrideBody },
    handler: async (request, reply) => {
      reply.code(201);
      return service.createHolidayOverride(request.body as never);
    },
  });

  fastify.get("/tariff-groups", {
    schema: { querystring: Type.Object({ clubId: Type.Optional(Type.String()) }) },
    handler: async (request) =>
      service.listTariffGroups((request.query as { clubId?: string }).clubId),
  });
  fastify.post("/tariff-groups", {
    schema: { body: TariffGroupBody },
    handler: async (request, reply) => {
      reply.code(201);
      return service.createTariffGroup(request.body as never);
    },
  });

  fastify.get("/tariffs", {
    schema: { querystring: Type.Object({ groupId: Type.Optional(Type.String()) }) },
    handler: async (request) => service.listTariffs((request.query as { groupId?: string }).groupId),
  });
  fastify.get("/tariffs/:id", {
    schema: { params: IdParams },
    handler: async (request) => service.getTariff((request.params as { id: string }).id),
  });
  fastify.post("/tariffs", {
    schema: { body: TariffBody },
    handler: async (request, reply) => {
      reply.code(201);
      return service.createTariff(request.body as never);
    },
  });
  fastify.patch("/tariffs/:id", {
    schema: { params: IdParams, body: Type.Partial(TariffBody) },
    handler: async (request) =>
      service.updateTariff((request.params as { id: string }).id, request.body as never),
  });

  fastify.get("/tariff-rules", {
    schema: { querystring: Type.Object({ tariffId: Type.Optional(Type.String()) }) },
    handler: async (request) =>
      service.listTariffRules((request.query as { tariffId?: string }).tariffId),
  });
  fastify.post("/tariff-rules", {
    schema: { body: TariffRuleBody },
    handler: async (request, reply) => {
      reply.code(201);
      return service.createTariffRule(request.body as never);
    },
  });
  fastify.patch("/tariff-rules/:id", {
    schema: { params: IdParams, body: Type.Partial(TariffRuleBody) },
    handler: async (request) =>
      service.updateTariffRule((request.params as { id: string }).id, request.body as never),
  });
  fastify.delete("/tariff-rules/:id", {
    schema: { params: IdParams },
    handler: async (request, reply) => {
      await service.deleteTariffRule((request.params as { id: string }).id);
      reply.code(204);
    },
  });

  fastify.get("/tariffs/quote", {
    schema: { querystring: QuoteQuery },
    handler: async (request) => {
      const q = request.query as {
        tariffId: string;
        zoneId: string;
        startAt: string;
        durationMinutes?: number;
      };
      return service.quote({
        tariffId: q.tariffId,
        zoneId: q.zoneId,
        startAt: new Date(q.startAt),
        durationMinutes: q.durationMinutes,
      });
    },
  });

  fastify.post("/subscriptions/purchase", {
    schema: { body: PurchaseSubscriptionBody },
    handler: async (request, reply) => {
      reply.code(201);
      return service.purchaseSubscription(request.body as never);
    },
  });
};

export default tariffRoutes;
