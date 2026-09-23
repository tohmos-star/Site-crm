import type {
  AutoBonusTrigger,
  Prisma,
  PrismaClient,
  RecalcPeriod,
  SourceChannel,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { NotFoundError } from "../../lib/errors.js";
import { BalanceService } from "../balance/service.js";
import type {
  AutoBonusRuleBody,
  GuestManualGroupBody,
  LoyaltySettingsBody,
  LoyaltyTierBody,
} from "./schemas.js";

type Tx = Prisma.TransactionClient;

const RECALC_PERIOD_MONTHS: Record<RecalcPeriod, number> = {
  M1: 1,
  M2: 2,
  M3: 3,
  M4: 4,
  M6: 6,
  M12: 12,
};

export interface EffectiveLoyalty {
  discountPercent: number;
  cashbackPercent: number;
}

export class LoyaltyService {
  private readonly balance: BalanceService;

  constructor(private readonly prisma: PrismaClient) {
    this.balance = new BalanceService(prisma);
  }

  // --- Config CRUD -----------------------------------------------------------

  listTiers() {
    return this.prisma.loyaltyTier.findMany({ orderBy: { sortOrder: "asc" } });
  }

  createTier(body: LoyaltyTierBody) {
    return this.prisma.loyaltyTier.create({ data: body });
  }

  listManualGroups() {
    return this.prisma.guestManualGroup.findMany();
  }

  createManualGroup(body: GuestManualGroupBody) {
    return this.prisma.guestManualGroup.create({ data: body });
  }

  async upsertSettings(body: LoyaltySettingsBody) {
    return this.prisma.loyaltySettings.upsert({
      where: { clubId: body.clubId },
      create: body,
      update: body,
    });
  }

  listAutoBonusRules(trigger?: AutoBonusTrigger) {
    return this.prisma.autoBonusRule.findMany({ where: trigger ? { trigger } : undefined });
  }

  createAutoBonusRule(body: AutoBonusRuleBody) {
    return this.prisma.autoBonusRule.create({ data: body });
  }

  async deleteAutoBonusRule(id: string) {
    const rule = await this.prisma.autoBonusRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundError("AutoBonusRule", id);
    await this.prisma.autoBonusRule.delete({ where: { id } });
  }

  // Ручная группа — назначается сотрудником напрямую на гостя (Guest.manualGroupId).
  async setManualGroup(guestId: string, manualGroupId: string | null) {
    const guest = await this.prisma.guest.findUnique({ where: { id: guestId } });
    if (!guest) throw new NotFoundError("Guest", guestId);
    if (manualGroupId) {
      const group = await this.prisma.guestManualGroup.findUnique({ where: { id: manualGroupId } });
      if (!group) throw new NotFoundError("GuestManualGroup", manualGroupId);
    }
    return this.prisma.guest.update({ where: { id: guestId }, data: { manualGroupId } });
  }

  // Автогруппа (уровень лояльности) обычно пересчитывается по отыгранным
  // часам (см. recalcGuestTier), но админ может назначить/переопределить её
  // вручную прямо в анкете гостя — например, до накопления нужных часов.
  async setTier(guestId: string, tierId: string | null) {
    const guest = await this.prisma.guest.findUnique({ where: { id: guestId } });
    if (!guest) throw new NotFoundError("Guest", guestId);
    if (tierId) {
      const tier = await this.prisma.loyaltyTier.findUnique({ where: { id: tierId } });
      if (!tier) throw new NotFoundError("LoyaltyTier", tierId);
    }
    return this.prisma.guestLoyaltyState.upsert({
      where: { guestId },
      create: { guestId, currentTierId: tierId },
      update: { currentTierId: tierId },
    });
  }

  // --- Discounts / cashback ---------------------------------------------------

  // Комбинирует авто-группу (по отыгранным часам) и ручную группу гостя.
  // sumDiscounts=true → складываем, иначе берём большую из двух (per club setting).
  async getEffectiveLoyalty(guestId: string, clubId: string): Promise<EffectiveLoyalty> {
    const [guest, settings] = await Promise.all([
      this.prisma.guest.findUnique({
        where: { id: guestId },
        include: { manualGroup: true, loyaltyState: { include: { currentTier: true } } },
      }),
      this.prisma.loyaltySettings.findUnique({ where: { clubId } }),
    ]);
    if (!guest) throw new NotFoundError("Guest", guestId);

    const tierDiscount = guest.loyaltyState?.currentTier?.discountPercent ?? 0;
    const tierCashback = guest.loyaltyState?.currentTier?.cashbackPercent ?? 0;
    const manualDiscount = guest.manualGroup?.discountPercent ?? 0;
    const manualCashback = guest.manualGroup?.cashbackPercent ?? 0;
    const sum = settings?.sumDiscounts ?? false;

    return {
      discountPercent: sum
        ? Math.min(100, tierDiscount + manualDiscount)
        : Math.max(tierDiscount, manualDiscount),
      cashbackPercent: sum
        ? Math.min(100, tierCashback + manualCashback)
        : Math.max(tierCashback, manualCashback),
    };
  }

  async applyLoyaltyCashback(
    client: PrismaClient | Tx,
    guestId: string,
    clubId: string,
    moneySpent: Decimal,
    ignoreLoyaltyDiscounts: boolean,
    referenceId?: string,
  ) {
    if (ignoreLoyaltyDiscounts || moneySpent.lte(0)) return null;
    const { cashbackPercent } = await this.getEffectiveLoyalty(guestId, clubId);
    if (cashbackPercent <= 0) return null;

    const bonus = moneySpent.mul(cashbackPercent).div(100);
    return this.balance.applyDelta(client, {
      guestId,
      kind: "BONUS",
      delta: bonus,
      source: "LOYALTY_CASHBACK",
      referenceType: "SESSION",
      referenceId,
    });
  }

  // --- Автобонусы (регистрация / пополнение) -----------------------------

  async applyAutoBonus(
    client: PrismaClient | Tx,
    params: {
      guestId: string;
      trigger: AutoBonusTrigger;
      clubId?: string;
      amount?: Decimal;
      sourceChannel?: SourceChannel;
    },
  ) {
    const rules = await this.prisma.autoBonusRule.findMany({
      where: { trigger: params.trigger, active: true },
    });

    const rule = rules.find((r) => {
      if (r.sourceChannel && r.sourceChannel !== params.sourceChannel) return false;
      // "Приложение" не привязывается к клубу — не фильтруем по clubId для APP.
      if (r.clubId && params.sourceChannel !== "APP" && r.clubId !== params.clubId) return false;
      if (params.trigger === "TOPUP" && params.amount) {
        if (r.minAmount && params.amount.lt(r.minAmount)) return false;
        if (r.maxAmount && params.amount.gt(r.maxAmount)) return false;
      }
      return true;
    });
    if (!rule) return null;

    const reward =
      rule.rewardType === "PERCENT" && params.amount
        ? params.amount.mul(rule.rewardValue).div(100)
        : new Decimal(rule.rewardValue);

    const source = params.trigger === "REGISTRATION" ? "AUTO_BONUS_REGISTRATION" : "AUTO_BONUS_TOPUP";
    return this.balance.applyDelta(client, {
      guestId: params.guestId,
      kind: "BONUS",
      delta: reward,
      source,
      referenceType: "NONE",
      referenceId: rule.id,
    });
  }

  async applyBirthdayBonusIfDue(guestId: string, clubId: string) {
    const [guest, settings] = await Promise.all([
      this.prisma.guest.findUnique({ where: { id: guestId }, include: { loyaltyState: true } }),
      this.prisma.loyaltySettings.findUnique({ where: { clubId } }),
    ]);
    if (!guest?.birthDate || !settings?.birthdayBonusEnabled) return null;

    const today = new Date();
    const isBirthday =
      guest.birthDate.getUTCMonth() === today.getUTCMonth() &&
      guest.birthDate.getUTCDate() === today.getUTCDate();
    if (!isBirthday) return null;

    const currentYear = today.getUTCFullYear();
    if (guest.loyaltyState?.lastBirthdayBonusYear === currentYear) return null; // уже начислено в этом году

    return this.prisma.$transaction(async (tx) => {
      const ledgerEntry = await this.balance.applyDelta(tx, {
        guestId,
        kind: "BONUS",
        delta: settings.birthdayBonusAmount,
        source: "BIRTHDAY_BONUS",
      });
      await tx.guestLoyaltyState.upsert({
        where: { guestId },
        create: { guestId, lastBirthdayBonusYear: currentYear },
        update: { lastBirthdayBonusYear: currentYear },
      });
      return ledgerEntry;
    });
  }

  // --- Пересчёт статуса по отыгранным часам -------------------------------
  //
  // Известное упрощение v1: период пересчёта берётся из настроек ПЕРВОГО
  // найденного клуба (гость не привязан к конкретному клубу в этой модели).
  // При появлении мультиклубной привязки гостя — считать период per-club.
  async recalcGuestTier(guestId: string) {
    const state = await this.prisma.guestLoyaltyState.upsert({
      where: { guestId },
      create: { guestId },
      update: {},
    });

    const anySettings = await this.prisma.loyaltySettings.findFirst();
    const periodMonths = RECALC_PERIOD_MONTHS[anySettings?.recalcPeriod ?? "M3"];
    const periodMs = periodMonths * 30 * 24 * 3600_000;
    const periodElapsed = Date.now() - state.periodStartedAt.getTime() >= periodMs;

    const sessions = await this.prisma.session.findMany({
      where: { guestId, status: "COMPLETED", completedAt: { gte: state.periodStartedAt } },
      select: { startedAt: true, completedAt: true },
    });
    const playedMinutes = sessions.reduce((sum, s) => {
      if (!s.completedAt) return sum;
      return sum + Math.max(0, (s.completedAt.getTime() - s.startedAt.getTime()) / 60000);
    }, 0);
    const playedHours = playedMinutes / 60;

    const tiers = await this.prisma.loyaltyTier.findMany({ orderBy: { minHours: "desc" } });
    const matchedTier = tiers.find(
      (t) => playedHours >= t.minHours && (t.maxHours == null || playedHours < t.maxHours),
    );

    return this.prisma.guestLoyaltyState.update({
      where: { guestId },
      data: {
        currentTierId: matchedTier?.id ?? null,
        playedMinutesInPeriod: Math.round(playedMinutes),
        lastRecalculatedAt: new Date(),
        ...(periodElapsed ? { periodStartedAt: new Date() } : {}),
      },
    });
  }
}
