import Fastify from "fastify";
import { env } from "./config/env.js";
import prismaPlugin from "./plugins/prisma.js";
import { DomainError } from "./lib/errors.js";

import clubRoutes from "./modules/clubs/routes.js";
import zoneRoutes from "./modules/zones/routes.js";
import deviceRoutes from "./modules/devices/routes.js";
import tariffRoutes from "./modules/tariffs/routes.js";
import bookingRoutes from "./modules/bookings/routes.js";
import guestRoutes from "./modules/guests/routes.js";
import balanceRoutes from "./modules/balance/routes.js";
import loyaltyRoutes from "./modules/loyalty/routes.js";
import refundRoutes from "./modules/refunds/routes.js";
import paymentRoutes from "./modules/payments/routes.js";

export async function buildApp() {
  const app = Fastify({
    logger: { level: env.logLevel },
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof DomainError) {
      reply.code(error.statusCode).send({ code: error.code, message: error.message });
      return;
    }
    const err = error as Error & { validation?: unknown };
    if (err.validation) {
      reply.code(400).send({ code: "VALIDATION_ERROR", message: err.message });
      return;
    }
    app.log.error(error);
    reply.code(500).send({ code: "INTERNAL_ERROR", message: "Internal server error" });
  });

  await app.register(prismaPlugin);

  app.get("/health", async () => ({ ok: true }));

  await app.register(clubRoutes, { prefix: "/api" });
  await app.register(zoneRoutes, { prefix: "/api" });
  await app.register(deviceRoutes, { prefix: "/api" });
  await app.register(tariffRoutes, { prefix: "/api" });
  await app.register(bookingRoutes, { prefix: "/api" });
  await app.register(guestRoutes, { prefix: "/api" });
  await app.register(balanceRoutes, { prefix: "/api" });
  await app.register(loyaltyRoutes, { prefix: "/api" });
  await app.register(refundRoutes, { prefix: "/api" });
  await app.register(paymentRoutes, { prefix: "/api" });

  return app;
}
