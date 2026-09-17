import { Decimal } from "@prisma/client/runtime/library";
import { PricingGapError } from "../../lib/errors.js";
import { dateToIsoDay, resolveDayTypeId, type DayTypeRecord, type HolidayOverrideRecord } from "./daytype.js";

export const MINUTES_PER_DAY = 1440;

export interface PriceWindowRule {
  startMinute: number;
  endMinute: number;
  pricePerMinute: Decimal;
}

// Суммирует цену за интервал [startMinute, endMinute) одного календарного дня,
// используя правила тарифной сетки этого дня. Бросает PricingGapError, если
// в сетке есть "дыра" — интервал без покрывающего правила.
export function priceForDayWindow(
  rules: PriceWindowRule[],
  startMinute: number,
  endMinute: number,
): Decimal {
  const sorted = [...rules].sort((a, b) => a.startMinute - b.startMinute);
  let cursor = startMinute;
  let total = new Decimal(0);

  for (const rule of sorted) {
    if (rule.endMinute <= cursor || rule.startMinute >= endMinute) continue;
    const segStart = Math.max(cursor, rule.startMinute);
    const segEnd = Math.min(endMinute, rule.endMinute);
    if (segEnd <= segStart) continue;
    if (segStart > cursor) {
      throw new PricingGapError(cursor, segStart);
    }
    total = total.add(rule.pricePerMinute.mul(segEnd - segStart));
    cursor = segEnd;
  }

  if (cursor < endMinute) {
    throw new PricingGapError(cursor, endMinute);
  }
  return total;
}

export function minuteOfDay(date: Date): number {
  const dayStart = startOfUtcDay(date);
  return Math.floor((date.getTime() - dayStart.getTime()) / 60000);
}

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export interface RuleSource {
  getRulesForDayType(dayTypeId: string): Promise<PriceWindowRule[]> | PriceWindowRule[];
}

// Считает стоимость интервала [startAt, startAt + durationMinutes), корректно
// разбивая интервал по календарным суткам (тарифы через полночь хранятся как
// два отдельных правила — до/после 00:00 — поэтому здесь просто идём по дням).
export async function computeIntervalPrice(
  startAt: Date,
  durationMinutes: number,
  dayTypes: DayTypeRecord[],
  holidayOverrides: HolidayOverrideRecord[],
  rules: RuleSource,
): Promise<Decimal> {
  let total = new Decimal(0);
  let remaining = durationMinutes;
  let cursor = new Date(startAt);

  while (remaining > 0) {
    const dayStart = startOfUtcDay(cursor);
    const minuteStart = minuteOfDay(cursor);
    const minutesLeftInDay = MINUTES_PER_DAY - minuteStart;
    const segmentMinutes = Math.min(remaining, minutesLeftInDay);

    const dayTypeId = resolveDayTypeId(dayStart, dayTypes, holidayOverrides);
    const dayRules = await rules.getRulesForDayType(dayTypeId);
    total = total.add(priceForDayWindow(dayRules, minuteStart, minuteStart + segmentMinutes));

    remaining -= segmentMinutes;
    cursor = new Date(dayStart.getTime() + MINUTES_PER_DAY * 60000);
  }

  return total;
}

// Для PACKAGE с фиксированным окончанием (напр. "ночной" до 06:00): сколько
// бы гость ни купил, действует до этого часа. Если startAt уже после
// fixedEndMinute, окончание переносится на следующие сутки.
export function computeFixedEndDurationMinutes(startAt: Date, fixedEndMinute: number): number {
  const startMinute = minuteOfDay(startAt);
  const end = fixedEndMinute <= startMinute ? fixedEndMinute + MINUTES_PER_DAY : fixedEndMinute;
  return end - startMinute;
}

export { dateToIsoDay };
export type { DayTypeRecord, HolidayOverrideRecord };
