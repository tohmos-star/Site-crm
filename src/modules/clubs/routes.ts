import type { FastifyPluginAsync } from "fastify";
import { ClubBody } from "./schemas.js";

// Клубы — справочник (Чапаевская 178 / Красноармейская 12А), меняется редко.
// Минимальный CRUD достаточен для v1; управление списком — задача админки.
const clubRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/clubs", { handler: async () => fastify.prisma.club.findMany() });

  fastify.post("/clubs", {
    schema: { body: ClubBody },
    handler: async (request, reply) => {
      reply.code(201);
      return fastify.prisma.club.create({ data: request.body as never });
    },
  });
};

export default clubRoutes;
