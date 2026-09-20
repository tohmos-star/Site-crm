import { Type, type Static } from "@sinclair/typebox";

export const CreateGuestBody = Type.Object({
  phone: Type.String({ minLength: 5 }),
  fio: Type.Optional(Type.String()),
});
export type CreateGuestBody = Static<typeof CreateGuestBody>;

export const UpdateGuestBody = Type.Object({
  phone: Type.Optional(Type.String({ minLength: 5 })),
  fio: Type.Optional(Type.String()),
  bonusPoints: Type.Optional(Type.Integer()),
});
export type UpdateGuestBody = Static<typeof UpdateGuestBody>;

export const GuestIdParams = Type.Object({ id: Type.String() });
export type GuestIdParams = Static<typeof GuestIdParams>;
