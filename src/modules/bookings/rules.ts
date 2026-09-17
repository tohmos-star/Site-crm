import { BookingConflictError } from "../../lib/errors.js";

// Согласованные бизнес-правила бронирования (404-project-context.md):
export const MIN_LEAD_MINUTES = 5; // лаг "сейчас → старт брони"
export const MIN_GAP_MINUTES = 60; // между концом одной брони и началом следующей на этом устройстве
export const EXTENSION_SAFETY_MARGIN_MINUTES = 30; // продление капается "следующая бронь − 30 мин"

export function assertLeadTime(now: Date, startAt: Date): void {
  const leadMinutes = (startAt.getTime() - now.getTime()) / 60000;
  if (leadMinutes < MIN_LEAD_MINUTES) {
    throw new BookingConflictError(
      `Booking must start at least ${MIN_LEAD_MINUTES} minutes from now (got ${leadMinutes.toFixed(1)})`,
    );
  }
}

export interface ExistingBookingWindow {
  id: string;
  startAt: Date;
  endAt: Date;
}

// Проверяет, что новая бронь [startAt, endAt) не пересекается и не подходит
// ближе MIN_GAP_MINUTES к любой другой активной брони этого устройства.
export function assertNoConflict(
  existing: ExistingBookingWindow[],
  startAt: Date,
  endAt: Date,
  excludeBookingId?: string,
): void {
  for (const booking of existing) {
    if (booking.id === excludeBookingId) continue;

    const gapBefore = (startAt.getTime() - booking.endAt.getTime()) / 60000;
    const gapAfter = (booking.startAt.getTime() - endAt.getTime()) / 60000;

    // Пересечение или слишком маленький зазор с любой стороны.
    const tooClose = !(gapBefore >= MIN_GAP_MINUTES || gapAfter >= MIN_GAP_MINUTES);
    if (tooClose) {
      throw new BookingConflictError(
        `Booking window conflicts with existing booking ${booking.id} ` +
          `(requires ${MIN_GAP_MINUTES}-minute gap between bookings on the same device)`,
      );
    }
  }
}

// Продление сессии капается следующей бронью этого устройства минус 30 минут.
// Если следующей брони нет — продление ограничено только оплаченным временем
// (проверяется на уровне баланса/тарифа, не здесь).
export function capExtension(requestedNewEnd: Date, nextBookingStartAt: Date | null): Date {
  if (!nextBookingStartAt) return requestedNewEnd;
  const cap = new Date(nextBookingStartAt.getTime() - EXTENSION_SAFETY_MARGIN_MINUTES * 60000);
  return requestedNewEnd < cap ? requestedNewEnd : cap;
}

export function generateBookingCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
