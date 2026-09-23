import { Type, type Static } from "@sinclair/typebox";

export const LoyaltyTierBody = Type.Object({
  name: Type.String({ minLength: 1 }),
  minHours: Type.Integer({ minimum: 0 }),
  maxHours: Type.Optional(Type.Integer({ minimum: 0 })),
  discountPercent: Type.Optional(Type.Integer({ minimum: 0, maximum: 100 })),
  cashbackPercent: Type.Optional(Type.Integer({ minimum: 0, maximum: 100 })),
  sortOrder: Type.Optional(Type.Integer()),
});
export type LoyaltyTierBody = Static<typeof LoyaltyTierBody>;

export const GuestManualGroupBody = Type.Object({
  name: Type.String({ minLength: 1 }),
  discountPercent: Type.Optional(Type.Integer({ minimum: 0, maximum: 100 })),
  cashbackPercent: Type.Optional(Type.Integer({ minimum: 0, maximum: 100 })),
});
export type GuestManualGroupBody = Static<typeof GuestManualGroupBody>;

export const LoyaltySettingsBody = Type.Object({
  clubId: Type.String(),
  sumDiscounts: Type.Optional(Type.Boolean()),
  recalcPeriod: Type.Optional(
    Type.Union([
      Type.Literal("M1"),
      Type.Literal("M2"),
      Type.Literal("M3"),
      Type.Literal("M4"),
      Type.Literal("M6"),
      Type.Literal("M12"),
    ]),
  ),
  birthdayBonusEnabled: Type.Optional(Type.Boolean()),
  birthdayBonusAmount: Type.Optional(Type.Number({ minimum: 0 })),
});
export type LoyaltySettingsBody = Static<typeof LoyaltySettingsBody>;

export const AutoBonusRuleBody = Type.Object({
  clubId: Type.Optional(Type.String()),
  trigger: Type.Union([Type.Literal("REGISTRATION"), Type.Literal("TOPUP")]),
  minAmount: Type.Optional(Type.Number({ minimum: 0 })),
  maxAmount: Type.Optional(Type.Number({ minimum: 0 })),
  rewardType: Type.Union([Type.Literal("PERCENT"), Type.Literal("FIXED")]),
  rewardValue: Type.Number({ minimum: 0 }),
  sourceChannel: Type.Optional(
    Type.Union([Type.Literal("CASH_DESK"), Type.Literal("APP"), Type.Literal("TERMINAL")]),
  ),
  active: Type.Optional(Type.Boolean()),
});
export type AutoBonusRuleBody = Static<typeof AutoBonusRuleBody>;

export const IdParams = Type.Object({ id: Type.String() });
export type IdParams = Static<typeof IdParams>;

export const GuestIdParams = Type.Object({ guestId: Type.String() });
export type GuestIdParams = Static<typeof GuestIdParams>;

export const SetManualGroupBody = Type.Object({
  manualGroupId: Type.Union([Type.String(), Type.Null()]),
});
export type SetManualGroupBody = Static<typeof SetManualGroupBody>;

export const SetTierBody = Type.Object({
  tierId: Type.Union([Type.String(), Type.Null()]),
});
export type SetTierBody = Static<typeof SetTierBody>;
