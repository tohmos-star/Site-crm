import { Type, type Static } from "@sinclair/typebox";

export const DayTypeBody = Type.Object({
  clubId: Type.String(),
  name: Type.String({ minLength: 1 }),
  // Ограничен по формату hex-цвета — см. тот же фикс для zones/schemas.ts
  // (произвольная строка попадала прямо в атрибут value="" в админке).
  color: Type.Optional(Type.String({ pattern: "^#[0-9a-fA-F]{6}$" })),
  weekdays: Type.Array(Type.Integer({ minimum: 0, maximum: 6 }), { minItems: 1 }),
});
export type DayTypeBody = Static<typeof DayTypeBody>;

export const DayTypeParams = Type.Object({ id: Type.String() });
export type DayTypeParams = Static<typeof DayTypeParams>;

export const HolidayOverrideBody = Type.Object({
  clubId: Type.String(),
  date: Type.String({ format: "date" }),
  dayTypeId: Type.String(),
});
export type HolidayOverrideBody = Static<typeof HolidayOverrideBody>;

export const TariffGroupBody = Type.Object({
  clubId: Type.String(),
  name: Type.String({ minLength: 1 }),
  sortOrder: Type.Optional(Type.Integer()),
});
export type TariffGroupBody = Static<typeof TariffGroupBody>;

export const TariffTypeSchema = Type.Union([
  Type.Literal("BASE"),
  Type.Literal("PACKAGE"),
  Type.Literal("SUBSCRIPTION"),
]);

export const TariffBody = Type.Object({
  groupId: Type.String(),
  type: TariffTypeSchema,
  name: Type.String({ minLength: 1 }),
  isFullBalance: Type.Optional(Type.Boolean()),
  packageMode: Type.Optional(Type.Union([Type.Literal("FIXED_DURATION"), Type.Literal("FIXED_END")])),
  packageDurationMin: Type.Optional(Type.Integer({ minimum: 1 })),
  packageFixedEndMin: Type.Optional(Type.Integer({ minimum: 0, maximum: 1439 })),
  subscriptionDurationMin: Type.Optional(Type.Integer({ minimum: 1 })),
  subscriptionLifetimeHrs: Type.Optional(Type.Integer({ minimum: 1 })),
  subscriptionPrice: Type.Optional(Type.Number({ minimum: 0 })),
  allowOnlineBooking: Type.Optional(Type.Boolean()),
  mobileOnly: Type.Optional(Type.Boolean()),
  ignoreLoyaltyDiscounts: Type.Optional(Type.Boolean()),
  allowCreditLine: Type.Optional(Type.Boolean()),
  bonusEarnPercent: Type.Optional(Type.Integer({ minimum: 0, maximum: 100 })),
  bonusSpendMaxPercent: Type.Optional(Type.Integer({ minimum: 0, maximum: 100 })),
  refundUnusedTime: Type.Optional(Type.Boolean()),
  minChargedMinutes: Type.Optional(Type.Integer({ minimum: 0 })),
  // Пусто/не передано = без ограничения (доступен всем уровням лояльности).
  allowedLoyaltyTierIds: Type.Optional(Type.Array(Type.String())),
  sortOrder: Type.Optional(Type.Integer()),
});
export type TariffBody = Static<typeof TariffBody>;

export const TariffRuleBody = Type.Object({
  tariffId: Type.String(),
  dayTypeId: Type.String(),
  zoneId: Type.String(),
  startMinute: Type.Integer({ minimum: 0, maximum: 1439 }),
  endMinute: Type.Integer({ minimum: 1, maximum: 1440 }),
  pricePerMinute: Type.Number({ minimum: 0 }),
  displayStartMinute: Type.Optional(Type.Integer({ minimum: 0, maximum: 1439 })),
  displayEndMinute: Type.Optional(Type.Integer({ minimum: 1, maximum: 1440 })),
});
export type TariffRuleBody = Static<typeof TariffRuleBody>;

export const IdParams = Type.Object({ id: Type.String() });
export type IdParams = Static<typeof IdParams>;

export const QuoteQuery = Type.Object({
  tariffId: Type.String(),
  zoneId: Type.String(),
  startAt: Type.String({ format: "date-time" }),
  durationMinutes: Type.Optional(Type.Integer({ minimum: 1 })),
});
export type QuoteQuery = Static<typeof QuoteQuery>;

export const PurchaseSubscriptionBody = Type.Object({
  guestId: Type.String(),
  tariffId: Type.String(),
});
export type PurchaseSubscriptionBody = Static<typeof PurchaseSubscriptionBody>;
