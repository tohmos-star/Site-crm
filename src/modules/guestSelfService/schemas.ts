import { Type, type Static } from "@sinclair/typebox";

// Как appFacade/CreateBookingFacadeBody: гость не выбирает tariffId явно,
// façade сама берёт Zone.defaultTariffId — startAt опционален, по умолчанию
// "сейчас" (для превью цены до выбора конкретного времени брони).
export const QuoteBody = Type.Object({
  stationId: Type.String(),
  minutes: Type.Integer({ minimum: 1 }),
  startAt: Type.Optional(Type.String({ format: "date-time" })),
});
export type QuoteBody = Static<typeof QuoteBody>;

export const StartWalkInSessionBody = Type.Object({
  stationId: Type.String(),
  minutes: Type.Integer({ minimum: 1 }),
});
export type StartWalkInSessionBody = Static<typeof StartWalkInSessionBody>;

export const ExtendSessionBody = Type.Object({
  minutes: Type.Integer({ minimum: 1 }),
});
export type ExtendSessionBody = Static<typeof ExtendSessionBody>;

export const SessionIdParams = Type.Object({ id: Type.String() });
export type SessionIdParams = Static<typeof SessionIdParams>;

export const GuestTopUpBody = Type.Object({
  amount: Type.Number({ exclusiveMinimum: 0 }),
});
export type GuestTopUpBody = Static<typeof GuestTopUpBody>;

export const GuestRefundRequestBody = Type.Object({
  amount: Type.Number({ exclusiveMinimum: 0 }),
  reason: Type.Optional(Type.String()),
});
export type GuestRefundRequestBody = Static<typeof GuestRefundRequestBody>;
