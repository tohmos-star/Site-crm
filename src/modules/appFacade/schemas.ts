import { Type, type Static } from "@sinclair/typebox";

// Как frontend/js/booking.js / android BookingViewModel: гость не выбирает
// tariffId явно, только место+время+длительность — façade сама берёт
// Zone.defaultTariffId.
export const CreateBookingFacadeBody = Type.Object({
  stationId: Type.String(),
  startAt: Type.String({ format: "date-time" }),
  minutes: Type.Integer({ minimum: 1 }),
});
export type CreateBookingFacadeBody = Static<typeof CreateBookingFacadeBody>;

export const BookingIdParams = Type.Object({ id: Type.String() });
export type BookingIdParams = Static<typeof BookingIdParams>;
