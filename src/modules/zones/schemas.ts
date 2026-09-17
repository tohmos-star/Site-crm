import { Type, type Static } from "@sinclair/typebox";

export const ZoneBody = Type.Object({
  clubId: Type.String(),
  nameRu: Type.String({ minLength: 1 }),
  nameEn: Type.Optional(Type.String()),
  color: Type.Optional(Type.String()),
  sortOrder: Type.Optional(Type.Integer()),
  isRoom: Type.Optional(Type.Boolean()),
});
export type ZoneBody = Static<typeof ZoneBody>;

export const ZoneParams = Type.Object({ id: Type.String() });
export type ZoneParams = Static<typeof ZoneParams>;
