import { Type, type Static } from "@sinclair/typebox";

export const DeviceKind = Type.Union([
  Type.Literal("PC"),
  Type.Literal("TV"),
  Type.Literal("TERMINAL"),
  Type.Literal("ADMIN_PC"),
]);

export const DeviceStatus = Type.Union([
  Type.Literal("FREE"),
  Type.Literal("BUSY"),
  Type.Literal("CONNECTING"),
  Type.Literal("TECH_MODE"),
  Type.Literal("LOCKED"),
  Type.Literal("DISABLED"),
]);

export const DeviceBody = Type.Object({
  clubId: Type.String(),
  zoneId: Type.String(),
  kind: Type.Optional(DeviceKind),
  name: Type.String({ minLength: 1 }),
  // Больше не вводится вручную в форме создания — при отсутствии
  // назначается автоматически (см. DeviceService.create): следующий
  // свободный номер в рамках клуба.
  cardNumber: Type.Optional(Type.Integer()),
  physicalName: Type.Optional(Type.String()),
  mac: Type.Optional(Type.String()),
  ip: Type.Optional(Type.String()),
  hostname: Type.Optional(Type.String()),
  uuid: Type.Optional(Type.String()),
  color: Type.Optional(Type.String()),
  comment: Type.Optional(Type.String()),
});
export type DeviceBody = Static<typeof DeviceBody>;

export const DeviceParams = Type.Object({ id: Type.String() });
export type DeviceParams = Static<typeof DeviceParams>;

export const SetStatusBody = Type.Object({ status: DeviceStatus });
export type SetStatusBody = Static<typeof SetStatusBody>;

export const BulkStatusBody = Type.Object({
  deviceIds: Type.Array(Type.String(), { minItems: 1 }),
  status: DeviceStatus,
});
export type BulkStatusBody = Static<typeof BulkStatusBody>;
