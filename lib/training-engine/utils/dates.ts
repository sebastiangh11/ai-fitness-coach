import type { TimeBudget } from "../types";
import type { Weekday } from "../config/focusPresets";

// ==============================
// Validation
// ==============================

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isISODateOnly(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !isNaN(d.getTime());
}

function assertISO(iso: string): void {
  if (!isISODateOnly(iso)) {
    throw new Error(`Invalid ISO date-only string: "${iso}"`);
  }
}

// ==============================
// Conversion
// ==============================

export function toISODateOnly(d: Date): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseISODateOnly(iso: string): Date {
  assertISO(iso);
  return new Date(`${iso}T00:00:00Z`);
}

// ==============================
// Arithmetic
// ==============================

export function addDaysISO(iso: string, days: number): string {
  assertISO(iso);
  const d = parseISODateOnly(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODateOnly(d);
}

// ==============================
// Weekday
// ==============================

const UTC_DAY_TO_WEEKDAY: Weekday[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const WEEKDAY_TO_UTC_DAY: Record<Weekday, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export function getWeekday(iso: string): Weekday {
  assertISO(iso);
  const d = parseISODateOnly(iso);
  return UTC_DAY_TO_WEEKDAY[d.getUTCDay()];
}

// ==============================
// Week Ranges
// ==============================

export function getWeekDates(weekStartISO: string, lengthDays = 7): string[] {
  assertISO(weekStartISO);
  return Array.from({ length: lengthDays }, (_, i) =>
    addDaysISO(weekStartISO, i)
  );
}

export function startOfWeekISO(
  iso: string,
  weekStartsOn: Weekday = "monday"
): string {
  assertISO(iso);
  const d = parseISODateOnly(iso);
  const currentDay = d.getUTCDay(); // 0=Sun … 6=Sat
  const startDay = WEEKDAY_TO_UTC_DAY[weekStartsOn];
  const diff = (currentDay - startDay + 7) % 7;
  return addDaysISO(iso, -diff);
}

// ==============================
// Time Budget
// ==============================

export function getTimeBudgetForDate(
  timeBudget: TimeBudget,
  iso: string,
  fallbackMinutes?: number
): number {
  assertISO(iso);
  const weekday = getWeekday(iso);
  const budget = timeBudget[weekday];
  if (budget !== undefined) return budget;
  return fallbackMinutes ?? 0;
}
