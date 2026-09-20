import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { UnauthorizedError } from "../lib/errors.js";

interface AuthJwtPayload {
  sub: string;
  role: "guest" | "admin";
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AuthJwtPayload;
    user: AuthJwtPayload;
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticateGuest: (request: FastifyRequest) => Promise<void>;
    authenticateAdmin: (request: FastifyRequest) => Promise<void>;
    authenticateDevice: (request: FastifyRequest) => Promise<void>;
  }
  interface FastifyRequest {
    guestId?: string;
    adminId?: string;
    deviceId?: string;
  }
}

// Три независимых способа авторизации для трёх разных вызывающих:
// - JWT с role="guest" — сайт и Android-приложение, выдаётся при логине гостя;
// - JWT с role="admin" — админка сайта, отдельный логин, не связан с Guest;
// - статичный agentToken станции — ПК-виджет, выдаётся один раз при
//   настройке станции и хранится локально на ПК (не привязан к гостю).
export default fp(async function authPlugin(fastify: FastifyInstance) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  await fastify.register(fastifyJwt, { secret });

  fastify.decorate("authenticateGuest", async (request: FastifyRequest) => {
    try {
      await request.jwtVerify();
    } catch {
      throw new UnauthorizedError("Invalid or missing guest token");
    }
    if (request.user.role !== "guest") throw new UnauthorizedError("Guest token required");
    request.guestId = request.user.sub;
  });

  fastify.decorate("authenticateAdmin", async (request: FastifyRequest) => {
    try {
      await request.jwtVerify();
    } catch {
      throw new UnauthorizedError("Invalid or missing admin token");
    }
    if (request.user.role !== "admin") throw new UnauthorizedError("Admin token required");
    request.adminId = request.user.sub;
  });

  fastify.decorate("authenticateDevice", async (request: FastifyRequest) => {
    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw new UnauthorizedError("Device token required");
    const device = await fastify.prisma.device.findUnique({ where: { agentToken: token } });
    if (!device) throw new UnauthorizedError("Invalid device token");
    request.deviceId = device.id;
  });
});
