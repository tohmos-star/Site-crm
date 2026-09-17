import { Type, type Static } from "@sinclair/typebox";

export const CreateRefundBody = Type.Object({
  guestId: Type.String(),
  amount: Type.Number({ exclusiveMinimum: 0 }),
  reason: Type.Optional(Type.String()),
});
export type CreateRefundBody = Static<typeof CreateRefundBody>;

export const DecideRefundBody = Type.Object({
  approve: Type.Boolean(),
  staffId: Type.String(),
  rejectionComment: Type.Optional(Type.String()),
});
export type DecideRefundBody = Static<typeof DecideRefundBody>;

export const IdParams = Type.Object({ id: Type.String() });
export type IdParams = Static<typeof IdParams>;
