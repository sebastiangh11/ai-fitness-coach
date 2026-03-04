/**
 * Minimal date utilities for the Calendar feature.
 * No external dependencies — pure arithmetic on ISO YYYY-MM-DD strings.
 */

/** Parse an ISO string into [year, month (1-based), day]. */
function parse(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m, d];
}

/** Format a Date object as YYYY-MM-DD. */
export function formatISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** YYYY-MM-DD for today (local time). */
export function todayISO(): string {
  return formatISODate(new Date());
}

/** Add n calendar days to an ISO date string. */
export function addDays(iso: string, n: number): string {
  const [y, m, d] = parse(iso);
  return formatISODate(new Date(y, m - 1, d + n));
}

/** Add n weeks (7-day multiples) to an ISO date string. */
export function addWeeks(iso: string, n: number): string {
  return addDays(iso, n * 7);
}

/**
 * Return the ISO date string for the Monday of the week containing `iso`.
 * If iso is already a Monday, returns it unchanged.
 */
export function startOfWeekMonday(iso: string): string {
  const [y, m, d] = parse(iso);
  const date = new Date(y, m - 1, d);
  const dow = date.getDay(); // 0 = Sunday
  const diff = dow === 0 ? -6 : 1 - dow;
  date.setDate(date.getDate() + diff);
  return formatISODate(date);
}

/** "Mon 3" style label. */
export function formatShortDate(iso: string): string {
  const [y, m, d] = parse(iso);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
  });
}

/** "Mar 3 — Mar 9" week range label. */
export function formatWeekRange(weekStartISO: string): string {
  const endISO = addDays(weekStartISO, 6);
  const [sy, sm, sd] = parse(weekStartISO);
  const [ey, em, ed] = parse(endISO);
  const start = new Date(sy, sm - 1, sd).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const end = new Date(ey, em - 1, ed).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return `${start} — ${end}`;
}

/** "March 2026" month label. */
export function formatMonthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

/**
 * Return all ISO dates for the calendar grid of a given month.
 * Grid starts on Monday and is padded to complete weeks (may include
 * days from adjacent months).
 */
export function monthGridDates(year: number, month: number): string[] {
  // First day of month
  const firstDay = new Date(year, month - 1, 1);
  // Start grid on the Monday on or before the 1st
  const gridStart = new Date(firstDay);
  const dow = firstDay.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  gridStart.setDate(firstDay.getDate() + diff);

  // Last day of month
  const lastDay = new Date(year, month, 0);
  // End grid on the Sunday on or after the last day
  const gridEnd = new Date(lastDay);
  const edow = lastDay.getDay();
  const ediff = edow === 0 ? 0 : 7 - edow;
  gridEnd.setDate(lastDay.getDate() + ediff);

  const dates: string[] = [];
  const cur = new Date(gridStart);
  while (cur <= gridEnd) {
    dates.push(formatISODate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

/** True if iso1 and iso2 fall in the same Mon–Sun week. */
export function isSameWeek(iso1: string, iso2: string): boolean {
  return startOfWeekMonday(iso1) === startOfWeekMonday(iso2);
}

/** Parse a query param value as a valid Monday ISO string, or return null. */
export function parseWeekParam(raw: string | null): string | null {
  if (raw === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  // Normalize to the Monday of that week
  return startOfWeekMonday(raw);
}
