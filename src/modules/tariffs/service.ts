import { Prisma, type PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { DomainError, NotFoundError } from "../../lib/errors.js";
import { BalanceService } from "../balance/service.js";
import { computeFixedEndDurationMinutes } from "./pricing.js";
import type {
  DayTypeBody,
  HolidayOverrideBody,
  PurchaseSubscriptionBody,
  TariffBody,
  TariffGroupBody,
  TariffRuleBody,
} from "./schemas.js";

export interface TariffQuote {
  paidMinutes: number;
  price: Decimal;
}

export class TariffService {
  private readonly balance: BalanceService;

  constructor(private readonly prisma: PrismaClient) {
    this.balance = new BalanceService(prisma);
  }

  // --- Day types / calendar -------------------------------------------------

  listDayTypes(clubId?: string) {
    return this.prisma.dayType.findMany({ where: clubId ? { clubId } : undefined });
  }

  async getDayType(id: string) {
    const dayType = await this.prisma.dayType.findUnique({ where: { id } });
    if (!dayType) throw new NotFoundError("DayType", id);
    return dayType;
  }

  createDayType(body: DayTypeBody) {
    return this.prisma.dayType.create({ data: body });
  }

  async updateDayType(id: string, body: Partial<DayTypeBody>) {
    await this.getDayType(id);
    return this.prisma.dayType.update({ where: { id }, data: body });
  }

  async deleteDayType(id: string) {
    await this.getDayType(id);

    const [ruleCount, overrideCount] = await Promise.all([
      this.prisma.tariffRule.count({ where: { dayTypeId: id } }),
      this.prisma.holidayOverride.count({ where: { dayTypeId: id } }),
    ]);
    // Без этой проверки prisma.dayType.delete() падает необработанной
    // FK-ошибкой (P2003) — см. тот же фикс в zones/service.ts.
    if (ruleCount > 0 || overrideCount > 0) {
      throw new DomainError(
        "DAY_TYPE_HAS_DEPENDENCIES",
        `Нельзя удалить тип дня: на него ссылаются ${ruleCount} правил(а) цен и ${overrideCount} переопределений(я) календаря`,
        409,
      );
    }

    await this.prisma.dayType.delete({ where: { id } });
  }

  listHolidayOverrides(clubId?: string) {
    return this.prisma.holidayOverride.findMany({ where: clubId ? { clubId } : undefined });
  }

  createHolidayOverride(body: HolidayOverrideBody) {
    return this.prisma.holidayOverride.create({
      data: { ...body, date: new Date(body.date) },
    });
  }

  // --- Tariff groups / tariffs / rules --------------------------------------

  listTariffGroups(clubId?: string) {
    return this.prisma.tariffGroup.findMany({ where: clubId ? { clubId } : undefined });
  }

  createTariffGroup(body: TariffGroupBody) {
    return this.prisma.tariffGroup.create({ data: body });
  }

  listTariffs(groupId?: string) {
    return this.prisma.tariff.findMany({
      where: groupId ? { groupId } : undefined,
      include: { allowedLoyaltyTiers: true },
    });
  }

  async getTariff(id: string) {
    const tariff = await this.prisma.tariff.findUnique({
      where: { id },
      include: { allowedLoyaltyTiers: true },
    });
    if (!tariff) throw new NotFoundError("Tariff", id);
    return tariff;
  }

  async createTariff(body: TariffBody) {
    this.assertTariffShape(body);
    const { allowedLoyaltyTierIds, ...rest } = body;
    try {
      return await this.prisma.tariff.create({
        data: {
          ...rest,
          allowedLoyaltyTiers: allowedLoyaltyTierIds
            ? { connect: allowedLoyaltyTierIds.map((tierId) => ({ id: tierId })) }
            : undefined,
        },
        include: { allowedLoyaltyTiers: true },
      });
    } catch (err) {
      throw this.mapLoyaltyTierConnectError(err);
    }
  }

  async updateTariff(id: string, body: Partial<TariffBody>) {
    await this.getTariff(id);
    const { allowedLoyaltyTierIds, ...rest } = body;
    try {
      return await this.prisma.tariff.update({
        where: { id },
        data: {
          ...rest,
          // set (не connect) — полностью заменяет список выбранных уровней тем,
          // что прислала форма (multi-select в админке шлёт весь набор целиком).
          allowedLoyaltyTiers: allowedLoyaltyTierIds
            ? { set: allowedLoyaltyTierIds.map((tierId) => ({ id: tierId })) }
            : undefined,
        },
        include: { allowedLoyaltyTiers: true },
      });
    } catch (err) {
      throw this.mapLoyaltyTierConnectError(err);
    }
  }

  async deleteTariff(id: string) {
    await this.getTariff(id);

    const [ruleCount, bookingCount, sessionCount, subscriptionCount, defaultZoneCount] = await Promise.all([
      this.prisma.tariffRule.count({ where: { tariffId: id } }),
      this.prisma.booking.count({ where: { tariffId: id } }),
      this.prisma.session.count({ where: { tariffId: id } }),
      this.prisma.guestSubscription.count({ where: { tariffId: id } }),
      this.prisma.zone.count({ where: { defaultTariffId: id } }),
    ]);
    // Тот же приём, что и в zones/day-types service.ts: явная проверка
    // вместо необработанной FK-ошибки (P2003) → голый 500.
    if (ruleCount > 0 || bookingCount > 0 || sessionCount > 0 || subscriptionCount > 0 || defaultZoneCount > 0) {
      throw new DomainError(
        "TARIFF_HAS_DEPENDENCIES",
        `Нельзя удалить тариф: на него ссылаются правила цен (${ruleCount}), брони (${bookingCount}), ` +
          `сессии (${sessionCount}), абонементы гостей (${subscriptionCount}) или зоны по умолчанию (${defaultZoneCount})`,
        409,
      );
    }

    await this.prisma.tariff.delete({ where: { id } });
  }

  // connect/set на несуществующий id уровня лояльности (устаревший кэш в
  // админке и т.п.) иначе падает необработанной P2025 → голый 500 без
  // объяснения, что именно не так.
  private mapLoyaltyTierConnectError(err: unknown): unknown {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return new DomainError(
        "INVALID_LOYALTY_TIER",
        "Один из выбранных уровней лояльности не найден — обновите страницу и попробуйте снова",
        400,
      );
    }
    return err;
  }

  private assertTariffShape(body: TariffBody) {
    if (body.type === "PACKAGE") {
      if (!body.packageMode) {
        throw new DomainError("INVALID_TARIFF", "PACKAGE tariff requires packageMode", 400);
      }
      if (body.packageMode === "FIXED_DURATION" && !body.packageDurationMin) {
        throw new DomainError(
          "INVALID_TARIFF",
          "FIXED_DURATION package requires packageDurationMin",
          400,
        );
      }
      if (body.packageMode === "FIXED_END" && body.packageFixedEndMin === undefined) {
        throw new DomainError(
          "INVALID_TARIFF",
          "FIXED_END package requires packageFixedEndMin",
          400,
        );
      }
    }
    if (body.type === "SUBSCRIPTION") {
      if (!body.subscriptionDurationMin || !body.subscriptionLifetimeHrs || !body.subscriptionPrice) {
        throw new DomainError(
          "INVALID_TARIFF",
          "SUBSCRIPTION tariff requires subscriptionDurationMin, subscriptionLifetimeHrs, subscriptionPrice",
          400,
        );
      }
    }
  }

  listTariffRules(tariffId?: string) {
    return this.prisma.tariffRule.findMany({ where: tariffId ? { tariffId } : undefined });
  }

  createTariffRule(body: TariffRuleBody) {
    this.assertTariffRuleShape(body);
    return this.prisma.tariffRule.create({
      data: { ...body, pricePerMinute: new Decimal(body.pricePerMinute) },
    });
  }

  async updateTariffRule(id: string, body: Partial<TariffRuleBody>) {
    const existing = await this.prisma.tariffRule.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("TariffRule", id);

    this.assertTariffRuleShape({ ...existing, ...body });

    return this.prisma.tariffRule.update({
      where: { id },
      data: {
        ...body,
        pricePerMinute: body.pricePerMinute !== undefined ? new Decimal(body.pricePerMinute) : undefined,
      },
    });
  }

  async deleteTariffRule(id: string) {
    const rule = await this.prisma.tariffRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundError("TariffRule", id);
    await this.prisma.tariffRule.delete({ where: { id } });
  }

  private assertTariffRuleShape(body: {
    startMinute: number;
    endMinute: number;
    displayStartMinute?: number | null;
    displayEndMinute?: number | null;
  }) {
    if (body.endMinute <= body.startMinute) {
      throw new DomainError(
        "INVALID_TARIFF_RULE",
        "endMinute must be greater than startMinute — split rules crossing midnight into two",
        400,
      );
    }
    if (
      body.displayStartMinute != null &&
      body.displayEndMinute != null &&
      body.displayEndMinute <= body.displayStartMinute
    ) {
      throw new DomainError(
        "INVALID_TARIFF_RULE",
        "displayEndMinute must be greater than displayStartMinute",
        400,
      );
    }
  }

  // --- Pricing ---------------------------------------------------------------

  // Считает paidMinutes и стоимость для BASE/PACKAGE тарифов на конкретном
  // устройстве/зоне. SUBSCRIPTION сюда не попадает — расходуется отдельно
  // через consumeSubscriptionMinutes, минуя тарифную сетку.
  async quote(params: {
    tariffId: string;
    zoneId: string;
    startAt: Date;
    durationMinutes?: number;
  }): Promise<TariffQuote> {
    const tariff = await this.getTariff(params.tariffId);

    if (tariff.type === "SUBSCRIPTION") {
      throw new DomainError(
        "SUBSCRIPTION_NOT_QUOTABLE",
        "Subscription time is not priced per-session — use consumeSubscriptionMinutes",
        400,
      );
    }

    let requestedMinutes: number;
    if (tariff.type === "BASE") {
      if (!params.durationMinutes) {
        throw new DomainError("MISSING_DURATION", "BASE tariff requires durationMinutes", 400);
      }
      requestedMinutes = params.durationMinutes;
    } else if (tariff.packageMode === "FIXED_DURATION") {
      requestedMinutes = tariff.packageDurationMin!;
    } else {
      requestedMinutes = computeFixedEndDurationMinutes(params.startAt, tariff.packageFixedEndMin!);
    }

    const zone = await this.prisma.zone.findUniqueOrThrow({ where: { id: params.zoneId } });
    const club = await this.prisma.club.findUniqueOrThrow({ where: { id: zone.clubId } });

    // Базовый почасовой биллинг (Club.pricePerHourRub/minChargedMinutes) —
    // плоская цена на весь клуб вместо сетки зона×тип дня×время (та сетка,
    // TariffRule/DayType, больше не настраивается из админки, см.
    // frontend/ARCHIVED_SECTIONS.md). minChargedMinutes — это ещё и
    // минимальная длительность самой сессии, не только минимальная оплата.
    const paidMinutes = Math.max(requestedMinutes, club.minChargedMinutes);
    const price = new Decimal(club.pricePerHourRub).mul(paidMinutes).div(60);

    return { paidMinutes, price };
  }

  // --- Subscriptions -----------------------------------------------------

  async purchaseSubscription(body: PurchaseSubscriptionBody) {
    const tariff = await this.getTariff(body.tariffId);
    if (tariff.type !== "SUBSCRIPTION") {
      throw new DomainError("NOT_A_SUBSCRIPTION", `Tariff ${tariff.id} is not a subscription`, 400);
    }

    return this.prisma.$transaction(async (tx) => {
      const ledgerEntry = await this.balance.applyDelta(tx, {
        guestId: body.guestId,
        kind: "MONEY",
        delta: new Decimal(tariff.subscriptionPrice!).neg(),
        source: "SUBSCRIPTION_PURCHASE",
      });

      const subscription = await tx.guestSubscription.create({
        data: {
          guestId: body.guestId,
          tariffId: tariff.id,
          totalMinutes: tariff.subscriptionDurationMin!,
          remainingMinutes: tariff.subscriptionDurationMin!,
          expiresAt: new Date(Date.now() + tariff.subscriptionLifetimeHrs! * 3600_000),
        },
      });

      return { subscription, ledgerEntry };
    });
  }

  // client опционален: если вызывающий код уже находится в своей транзакции
  // (напр. SessionService.choosePlanForWalkIn), нужно передать её tx — иначе
  // это откроет независимую вложенную транзакцию и сломает атомарность.
  async consumeSubscriptionMinutes(
    subscriptionId: string,
    minutes: number,
    client: PrismaClient | Prisma.TransactionClient = this.prisma,
  ) {
    const run = async (tx: PrismaClient | Prisma.TransactionClient) => {
      const subscription = await tx.guestSubscription.findUnique({ where: { id: subscriptionId } });
      if (!subscription) throw new NotFoundError("GuestSubscription", subscriptionId);
      if (subscription.expiresAt < new Date()) {
        throw new DomainError("SUBSCRIPTION_EXPIRED", `Subscription ${subscriptionId} has expired`, 422);
      }
      if (subscription.remainingMinutes < minutes) {
        throw new DomainError(
          "SUBSCRIPTION_INSUFFICIENT_MINUTES",
          `Subscription ${subscriptionId} has only ${subscription.remainingMinutes} minutes left`,
          422,
        );
      }
      return tx.guestSubscription.update({
        where: { id: subscriptionId },
        data: { remainingMinutes: subscription.remainingMinutes - minutes },
      });
    };

    return client === this.prisma ? this.prisma.$transaction((tx) => run(tx)) : run(client);
  }
}
