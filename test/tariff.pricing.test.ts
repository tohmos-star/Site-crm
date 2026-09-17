import { describe, expect, it } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";
import {
  computeFixedEndDurationMinutes,
  computeIntervalPrice,
  priceForDayWindow,
} from "../src/modules/tariffs/pricing.js";
import { PricingGapError } from "../src/lib/errors.js";

const rule = (startMinute: number, endMinute: number, price: number) => ({
  startMinute,
  endMinute,
  pricePerMinute: new Decimal(price),
});

describe("priceForDayWindow", () => {
  it("sums price across a single rule", () => {
    const total = priceForDayWindow([rule(0, 1440, 2)], 60, 120);
    expect(total.toString()).toBe("120");
  });

  it("sums price across two adjoining rules split at midnight-eve boundary", () => {
    const rules = [rule(0, 480, 1), rule(480, 1440, 2)];
    // 460..500 spans both rules: 20 min @1 + 20 min @2 = 60
    const total = priceForDayWindow(rules, 460, 500);
    expect(total.toString()).toBe("60");
  });

  it("throws PricingGapError when a segment of the window is uncovered", () => {
    const rules = [rule(0, 100, 1), rule(200, 300, 1)];
    expect(() => priceForDayWindow(rules, 50, 250)).toThrow(PricingGapError);
  });
});

describe("computeIntervalPrice — midnight crossing", () => {
  const dayTypes = [{ id: "weekday", weekdays: [0, 1, 2, 3, 4, 5, 6] }];
  const holidays: { dateIso: string; dayTypeId: string }[] = [];

  it("splits a booking that crosses midnight across two calendar days", async () => {
    // Правило одинаковое на весь день (0..1440) @ 2/мин на оба календарных дня.
    const price = await computeIntervalPrice(
      new Date("2026-01-01T23:30:00.000Z"),
      60, // 30 min in day1 + 30 min in day2
      dayTypes,
      holidays,
      { getRulesForDayType: () => [rule(0, 1440, 2)] },
    );
    expect(price.toString()).toBe("120"); // 60 min * 2/min regardless of split
  });

  it("uses a different rule per calendar day when the grid differs", async () => {
    let callCount = 0;
    const price = await computeIntervalPrice(
      new Date("2026-01-01T23:30:00.000Z"),
      60,
      dayTypes,
      holidays,
      {
        getRulesForDayType: () => {
          callCount += 1;
          return [rule(0, 1440, callCount)]; // day1 -> 1/min, day2 -> 2/min
        },
      },
    );
    // 30 min @1 (day1) + 30 min @2 (day2) = 30 + 60 = 90
    expect(price.toString()).toBe("90");
  });
});

describe("computeFixedEndDurationMinutes", () => {
  it("computes minutes until a same-day fixed end", () => {
    const start = new Date("2026-01-01T04:00:00.000Z"); // minute 240
    expect(computeFixedEndDurationMinutes(start, 360)).toBe(120); // until 06:00
  });

  it("rolls over to the next day when start is already past the fixed end", () => {
    const start = new Date("2026-01-01T23:00:00.000Z"); // minute 1380
    // "ночной" package until 06:00 (minute 360) started at 23:00 -> 7 hours
    expect(computeFixedEndDurationMinutes(start, 360)).toBe(420);
  });
});
