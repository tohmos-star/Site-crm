import { Type, type Static } from "@sinclair/typebox";

export const TopUpBody = Type.Object({
  guestId: Type.String(),
  amount: Type.Number({ exclusiveMinimum: 0 }),
  clubId: Type.Optional(Type.String()),
  sourceChannel: Type.Optional(
    Type.Union([Type.Literal("CASH_DESK"), Type.Literal("APP"), Type.Literal("TERMINAL")]),
  ),
});
export type TopUpBody = Static<typeof TopUpBody>;

export const IdParams = Type.Object({ id: Type.String() });
export type IdParams = Static<typeof IdParams>;
