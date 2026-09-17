import { Type, type Static } from "@sinclair/typebox";

export const BalanceKind = Type.Union([Type.Literal("MONEY"), Type.Literal("BONUS")]);

export const ManualAdjustBody = Type.Object({
  kind: BalanceKind,
  delta: Type.Number(),
  sourceChannel: Type.Union([
    Type.Literal("ADMIN_CONSOLE"),
    Type.Literal("BONUS_CONSOLE"),
    Type.Literal("GUEST_BALANCE_PAGE"),
    Type.Literal("API"),
  ]),
  staffId: Type.Optional(Type.String()),
  comment: Type.Optional(Type.String()),
});
export type ManualAdjustBody = Static<typeof ManualAdjustBody>;

export const IdParams = Type.Object({ id: Type.String() });
export type IdParams = Static<typeof IdParams>;
