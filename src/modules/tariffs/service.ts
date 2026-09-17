import type { Prisma, PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { DomainError, NotFoundError } from "../../lib/errors.js";
import { BalanceService } from "../balance/service.js";
import {
  computeFixedEndDurationMinutes,
  computeIntervalPrice,
  dateToIsoDay,
} from "./pricing.js";
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

  createDayType(body: DayTypeBody) {
    return this.prisma.dayType.create({ data: body });
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
    return this.prisma.tariff.findMany({ where: groupId ? { groupId } : undefined });
  }

  async getTariff(id: string) {
    const tariff = await this.prisma.tariff.findUnique({ where: { id } });
    if (!tariff) throw new NotFoundError("Tariff", id);
    return tariff;
  }

  createTariff(body: TariffBody) {
    this.assertTariffShape(body);
    return this.prisma.tariff.create({ data: body });
  }

  async updateTariff(id: string, body: Partial<TariffBody>) {
    await this.getTariff(id);
    return this.prisma.tariff.update({ where: { id }, data: body });
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
    if (body.endMinute <= body.startMinute) {
      throw new DomainError(
        "INVALID_TARIFF_RULE",
        "endMinute must be greater than startMinute — split rules crossing midnight into two",
        400,
      );
    }
    return this.prisma.tariffRule.create({
      data: { ...body, pricePerMinute: new Decimal(body.pricePerMinute) },
    });
  }

  async deleteTariffRule(id: string) {
    const rule = await this.prisma.tariffRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundError("TariffRule", id);
    await this.prisma.tariffRule.delete({ where: { id } });
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

    let paidMinutes: number;
    if (tariff.type === "BASE") {
      if (!params.durationMinutes) {
        throw new DomainError("MISSING_DURATION", "BASE tariff requires durationMinutes", 400);
      }
      paidMinutes = params.durationMinutes;
    } else if (tariff.packageMode === "FIXED_DURATION") {
      paidMinutes = tariff.packageDurationMin!;
    } else {
      paidMinutes = computeFixedEndDurationMinutes(params.startAt, tariff.packageFixedEndMin!);
    }

    const zone = await this.prisma.zone.findUniqueOrThrow({ where: { id: params.zoneId } });
    const dayTypes = await this.prisma.dayType.findMany({ where: { clubId: zone.clubId } });
    const holidays = await this.prisma.holidayOverride.findMany({ where: { clubId: zone.clubId } });

    const price = await computeIntervalPrice(
      params.startAt,
      paidMinutes,
      dayTypes,
      holidays.map((h) => ({ dateIso: dateToIsoDay(h.date), dayTypeId: h.dayTypeId })),
      {
        getRulesForDayType: (dayTypeId) =>
          this.prisma.tariffRule.findMany({
            where: { tariffId: tariff.id, zoneId: params.zoneId, dayTypeId },
          }),
      },
    );

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
