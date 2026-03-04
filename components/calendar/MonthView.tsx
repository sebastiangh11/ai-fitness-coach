"use client";

import { monthGridDates, startOfWeekMonday, todayISO } from "@/lib/calendar/dates";
import type { WeekPlanSnapshot } from "@/lib/api/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const DOW_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const STATUS_DOT: Record<string, string> = {
  planned: "bg-blue-500",
  completed: "bg-green-500",
  missed: "bg-red-500",
  modified: "bg-amber-500",
};

// ── MonthView ─────────────────────────────────────────────────────────────────

export interface MonthViewProps {
  /** 4-digit year */
  year: number;
  /** 1-indexed month */
  month: number;
  /** All loaded/loading week snapshots keyed by Monday ISO */
  snapshots: Record<string, WeekPlanSnapshot | null>;
  /** Which weeks are still in flight */
  loadingWeeks: Set<string>;
}

export function MonthView({ year, month, snapshots, loadingWeeks }: MonthViewProps) {
  const today = todayISO();
  const gridDates = monthGridDates(year, month);

  return (
    <div>
      {/* Day-of-week header */}
      <div className="mb-1 grid grid-cols-7 text-center">
        {DOW_LABELS.map((label) => (
          <span
            key={label}
            className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600"
          >
            {label}
          </span>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {gridDates.map((iso) => {
          const [, cellMonth, cellDay] = iso.split("-").map(Number);
          const isCurrentMonth = cellMonth === month;
          const isToday = iso === today;

          const weekMonday = startOfWeekMonday(iso);
          const snapshot = snapshots[weekMonday] ?? null;
          const isLoading = loadingWeeks.has(weekMonday);
          const planDay = snapshot?.planDays.find((d) => d.date === iso);

          // Dot indicator
          let dot: React.ReactNode = null;
          if (isLoading) {
            dot = (
              <span className="h-1 w-1 animate-pulse rounded-full bg-zinc-700" />
            );
          } else if (planDay !== undefined) {
            if (planDay.primary !== undefined) {
              const dotCls = STATUS_DOT[planDay.status] ?? "bg-zinc-500";
              dot = <span className={`h-1.5 w-1.5 rounded-full ${dotCls}`} />;
            } else {
              // rest day
              dot = <span className="h-1.5 w-1.5 rounded-full bg-zinc-700" />;
            }
          }

          return (
            <div
              key={iso}
              className={`flex flex-col items-center gap-1 py-2 rounded-lg ${
                isToday ? "bg-blue-500/10" : ""
              }`}
            >
              <span
                className={`text-xs leading-none ${
                  isToday
                    ? "font-bold text-blue-400"
                    : isCurrentMonth
                      ? "font-medium text-zinc-300"
                      : "text-zinc-700"
                }`}
              >
                {cellDay}
              </span>
              <div className="flex h-2 items-center">{dot}</div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-5 flex flex-wrap gap-4 border-t border-zinc-800 pt-4">
        {[
          { label: "Planned", cls: "bg-blue-500" },
          { label: "Completed", cls: "bg-green-500" },
          { label: "Missed", cls: "bg-red-500" },
          { label: "Rest", cls: "bg-zinc-700" },
        ].map(({ label, cls }) => (
          <span key={label} className="flex items-center gap-1.5 text-xs text-zinc-500">
            <span className={`h-2 w-2 rounded-full ${cls}`} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
