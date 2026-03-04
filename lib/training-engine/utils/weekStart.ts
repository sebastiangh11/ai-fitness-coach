import { startOfWeekISO } from "./dates";

/**
 * Given any valid YYYY-MM-DD date string, returns the ISO date of the
 * Monday that starts the containing week. Throws on invalid input.
 */
export function toWeekStartISO(dateISO: string): string {
  return startOfWeekISO(dateISO, "monday");
}
