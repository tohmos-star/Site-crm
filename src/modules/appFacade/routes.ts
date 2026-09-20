import type { FastifyPluginAsync } from "fastify";
import { AppFacadeService, InsufficientBalanceFacadeError } from "./service.js";
import { BookingIdParams, CreateBookingFacadeBody } from "./schemas.js";

const appFacadeRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new AppFacadeService(fastify.prisma);

  fastify.get("/stations", async () => ({ stations: await service.listStations() }));

  fastify.get("/bookings/mine", {
    preHandler: fastify.authenticateGuest,
    handler: async (request) => ({ bookings: await service.myBookings(request.guestId!) }),
  });

  fastify.post("/bookings", {
    preHandler: fastify.authenticateGuest,
    schema: { body: CreateBookingFacadeBody },
    handler: async (request, reply) => {
      const { stationId, startAt, minutes } = request.body as {
        stationId: string;
        startAt: string;
        minutes: number;
      };
      try {
        const booking = await service.createBooking(request.guestId!, stationId, startAt, minutes);
        reply.code(201);
        return { booking };
      } catch (error) {
        if (error instanceof InsufficientBalanceFacadeError) {
          reply.code(402);
          return { required: error.required, available: error.available };
        }
        throw error;
      }
    },
  });

  fastify.post("/bookings/:id/cancel", {
    preHandler: fastify.authenticateGuest,
    schema: { params: BookingIdParams },
    handler: async (request) => {
      const { id } = request.params as { id: string };
      return service.cancelBooking(request.guestId!, id);
    },
  });
};

export default appFacadeRoutes;
