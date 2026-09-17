import { Type, type Static } from "@sinclair/typebox";

export const CreateBookingBody = Type.Object({
  deviceId: Type.String(),
  guestId: Type.String(),
  tariffId: Type.String(),
  startAt: Type.String({ format: "date-time" }),
  durationMinutes: Type.Optional(Type.Integer({ minimum: 1 })),
});
export type CreateBookingBody = Static<typeof CreateBookingBody>;

export const IdParams = Type.Object({ id: Type.String() });
export type IdParams = Static<typeof IdParams>;

export const ActivateBody = Type.Object({
  code: Type.String(),
  deviceId: Type.String(),
});
export type ActivateBody = Static<typeof ActivateBody>;

export const ExtendBody = Type.Object({
  minutes: Type.Integer({ minimum: 1 }),
});
export type ExtendBody = Static<typeof ExtendBody>;

export const StartWalkInBody = Type.Object({
  deviceId: Type.String(),
  guestId: Type.String(),
});
export type StartWalkInBody = Static<typeof StartWalkInBody>;

export const ChoosePlanBody = Type.Object({
  tariffId: Type.String(),
  durationMinutes: Type.Optional(Type.Integer({ minimum: 1 })),
  subscriptionId: Type.Optional(Type.String()),
});
export type ChoosePlanBody = Static<typeof ChoosePlanBody>;
