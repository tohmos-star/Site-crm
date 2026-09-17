import { Type, type Static } from "@sinclair/typebox";

export const ClubBody = Type.Object({
  name: Type.String({ minLength: 1 }),
  address: Type.String({ minLength: 1 }),
  timezone: Type.Optional(Type.String()),
});
export type ClubBody = Static<typeof ClubBody>;
