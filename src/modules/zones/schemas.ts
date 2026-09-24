import { Type, type Static } from "@sinclair/typebox";

export const ZoneBody = Type.Object({
  clubId: Type.String(),
  nameRu: Type.String({ minLength: 1 }),
  nameEn: Type.Optional(Type.String()),
  // Ограничен по формату hex-цвета — без этого произвольная строка попадала
  // прямо в атрибут value="" в админке (frontend/admin/app.js) без экранирования.
  color: Type.Optional(Type.String({ pattern: "^#[0-9a-fA-F]{6}$" })),
  sortOrder: Type.Optional(Type.Integer()),
  isRoom: Type.Optional(Type.Boolean()),
  // Null первым в union — иначе Ajv (coerceTypes: true) молча превращает
  // null в "" при валидации, и сброс тарифа на "не выбран" падает с
  // нарушением внешнего ключа вместо реального NULL (см. тот же фикс в
  // loyalty/schemas.ts).
  defaultTariffId: Type.Optional(Type.Union([Type.Null(), Type.String()])),
});
export type ZoneBody = Static<typeof ZoneBody>;

export const ZoneParams = Type.Object({ id: Type.String() });
export type ZoneParams = Static<typeof ZoneParams>;
