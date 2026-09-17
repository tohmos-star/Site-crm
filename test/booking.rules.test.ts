import { describe, expect, it } from "vitest";
import { assertLeadTime, assertNoConflict, capExtension, generateBookingCode } from "../src/modules/bookings/rules.js";
import { BookingConflictError } from "../src/lib/errors.js";

describe("assertLeadTime", () => {
  const now = new Date("2026-01-01T10:00:00Z");

  it("rejects a start less than 5 minutes from now", () => {
    expect(() => assertLeadTime(now, new Date("2026-01-01T10:04:00Z"))).toThrow(BookingConflictError);
  });

  it("accepts a start exactly 5 minutes from now", () => {
    expect(() => assertLeadTime(now, new Date("2026-01-01T10:05:00Z"))).not.toThrow();
  });

  it("accepts a start well in the future", () => {
    expect(() => assertLeadTime(now, new Date("2026-01-01T12:00:00Z"))).not.toThrow();
  });
});

describe("assertNoConflict", () => {
  const existing = [
    { id: "b1", startAt: new Date("2026-01-01T10:00:00Z"), endAt: new Date("2026-01-01T11:00:00Z") },
  ];

  it("rejects an overlapping window", () => {
    expect(() =>
      assertNoConflict(existing, new Date("2026-01-01T10:30:00Z"), new Date("2026-01-01T11:30:00Z")),
    ).toThrow(BookingConflictError);
  });

  it("rejects a window with less than 60 minutes gap after", () => {
    expect(() =>
      assertNoConflict(existing, new Date("2026-01-01T11:30:00Z"), new Date("2026-01-01T12:00:00Z")),
    ).toThrow(BookingConflictError);
  });

  it("rejects a window with less than 60 minutes gap before", () => {
    expect(() =>
      assertNoConflict(existing, new Date("2026-01-01T08:30:00Z"), new Date("2026-01-01T09:30:00Z")),
    ).toThrow(BookingConflictError);
  });

  it("accepts a window with exactly 60 minutes gap after", () => {
    expect(() =>
      assertNoConflict(existing, new Date("2026-01-01T12:00:00Z"), new Date("2026-01-01T12:30:00Z")),
    ).not.toThrow();
  });

  it("ignores the excluded booking id (self on update)", () => {
    expect(() =>
      assertNoConflict(
        existing,
        new Date("2026-01-01T10:00:00Z"),
        new Date("2026-01-01T11:00:00Z"),
        "b1",
      ),
    ).not.toThrow();
  });
});

describe("capExtension", () => {
  it("returns the requested end when there is no next booking", () => {
    const requested = new Date("2026-01-01T12:00:00Z");
    expect(capExtension(requested, null)).toEqual(requested);
  });

  it("caps at next booking start minus 30 minutes", () => {
    const requested = new Date("2026-01-01T12:00:00Z");
    const nextStart = new Date("2026-01-01T12:20:00Z");
    expect(capExtension(requested, nextStart)).toEqual(new Date("2026-01-01T11:50:00Z"));
  });

  it("returns the requested end when it is already before the cap", () => {
    const requested = new Date("2026-01-01T10:00:00Z");
    const nextStart = new Date("2026-01-01T12:00:00Z");
    expect(capExtension(requested, nextStart)).toEqual(requested);
  });
});

describe("generateBookingCode", () => {
  it("generates a 6-digit numeric code", () => {
    const code = generateBookingCode();
    expect(code).toMatch(/^\d{6}$/);
  });
});
