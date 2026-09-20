import { Type, type Static } from "@sinclair/typebox";

export const RedeemCodeBody = Type.Object({
  code: Type.String({ minLength: 1 }),
});
export type RedeemCodeBody = Static<typeof RedeemCodeBody>;

export const ExtendSessionBody = Type.Object({
  minutes: Type.Integer({ minimum: 1 }),
});
export type ExtendSessionBody = Static<typeof ExtendSessionBody>;

export const SessionIdParams = Type.Object({ id: Type.String() });
export type SessionIdParams = Static<typeof SessionIdParams>;
