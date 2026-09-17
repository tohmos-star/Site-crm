// Известное упрощение v1: тип дня определяется по weekday в UTC, без учёта
// таймзоны клуба (Europe/Samara). Для booking/pricing внутри одного региона
// на практике разница проявляется только в полночь по UTC — приемлемо для
// первой версии, но стоит заменить на tz-aware вычисление (date-fns-tz)
// при мультирегиональном масштабировании.

export interface DayTypeRecord {
  id: string;
  weekdays: number[]; // 0=Sunday..6=Saturday
}

export interface HolidayOverrideRecord {
  dateIso: string; // YYYY-MM-DD
  dayTypeId: string;
}

export function dateToIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function resolveDayTypeId(
  date: Date,
  dayTypes: DayTypeRecord[],
  holidayOverrides: HolidayOverrideRecord[],
): string {
  const iso = dateToIsoDay(date);
  const override = holidayOverrides.find((h) => h.dateIso === iso);
  if (override) return override.dayTypeId;

  const weekday = date.getUTCDay();
  const match = dayTypes.find((dt) => dt.weekdays.includes(weekday));
  if (!match) {
    throw new Error(`No DayType configured for weekday ${weekday}`);
  }
  return match.id;
}
