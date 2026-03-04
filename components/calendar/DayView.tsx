"use client";

import Link from "next/link";
import { addDays, todayISO } from "@/lib/calendar/dates";
import type { PlanDay, WeekPlanSnapshot } from "@/lib/api/types";

// ── Status styles ─────────────────────────────────────────────────────────────

const STATUS_PILL: Record<string, string> = {
  planned: "bg-blue-500/20 text-blue-300",
  completed: "bg-green-500/20 text-green-300",
  missed: "bg-red-500/20 text-red-300",
  modified: "bg-amber-500/20 text-amber-300",
};

// ── Day chip (compact selector row) ──────────────────────────────────────────

function DayChip({
  iso,
  day,
  isSelected,
  isToday,
  onClick,
}: {
  iso: string;
  day: PlanDay | undefined;
  isSelected: boolean;
  isToday: boolean;
  onClick: () => void;
}) {
  const [y, m, d] = iso.split("-").map(Number);
  const weekday = new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short" });

  let dot: React.ReactNode = <span className="h-1.5 w-1.5 rounded-full bg-zinc-800" />;
  if (day !== undefined) {
    if (day.primary === undefined) {
      dot = <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />;
    } else if (day.status === "completed") {
      dot = <span className="h-1.5 w-1.5 rounded-full bg-green-500" />;
    } else if (day.status === "missed") {
      dot = <span className="h-1.5 w-1.5 rounded-full bg-red-500" />;
    } else {
      dot = <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />;
    }
  }

  return (
    <button
      onClick={onClick}
      className={`flex flex-1 flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 transition-colors ${
        isSelected
          ? "border-blue-500 bg-blue-500/10 text-blue-300"
          : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
      }`}
    >
      <span className="text-[10px] font-medium uppercase tracking-wide">{weekday}</span>
      <span className={`text-sm font-semibold ${isToday && !isSelected ? "text-blue-400" : ""}`}>
        {d}
      </span>
      {dot}
    </button>
  );
}

// ── Full detail card ──────────────────────────────────────────────────────────

function DayDetailCard({
  iso,
  day,
  loading,
}: {
  iso: string;
  day: PlanDay | undefined;
  loading: boolean;
}) {
  const today = todayISO();
  const isToday = iso === today;

  const [y, m, d] = iso.split("-").map(Number);
  const dateLabel = new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  if (loading) {
    return (
      <div className="animate-pulse rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="mb-4 h-3 w-32 rounded bg-zinc-800" />
        <div className="h-6 w-52 rounded bg-zinc-800" />
        <div className="mt-3 h-3 w-40 rounded bg-zinc-800" />
        <div className="mt-2 h-3 w-28 rounded bg-zinc-800" />
      </div>
    );
  }

  if (day === undefined) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {dateLabel}
        </p>
        <p className="text-sm text-zinc-600">No plan loaded for this date.</p>
      </div>
    );
  }

  const s = day.primary;
  const badgeCls = STATUS_PILL[day.status] ?? "bg-zinc-700 text-zinc-400";
  const borderCls = isToday ? "border-blue-500/40" : "border-zinc-700";

  return (
    <div className={`rounded-xl border ${borderCls} bg-zinc-900 p-6`}>
      {/* Header row */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{dateLabel}</p>
        <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-semibold ${badgeCls}`}>
          {day.status}
        </span>
      </div>

      {s !== undefined ? (
        <>
          <h2 className="text-2xl font-bold text-zinc-50">{s.title}</h2>

          {/* Metrics row */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-400">
            <span>{s.type}</span>
            <span className="text-zinc-700">·</span>
            <span>{s.durationMinutes} min</span>
            <span className="text-zinc-700">·</span>
            <span>RPE {s.targetRpe}</span>
            {s.intensity !== undefined && (
              <>
                <span className="text-zinc-700">·</span>
                <span>{s.intensity}</span>
              </>
            )}
            {s.load !== undefined && (
              <>
                <span className="text-zinc-700">·</span>
                <span>Load {s.load}</span>
              </>
            )}
          </div>

          {s.description !== undefined && (
            <p className="mt-4 text-sm leading-relaxed text-zinc-500">{s.description}</p>
          )}

          {isToday && (
            <div className="mt-6 border-t border-zinc-800 pt-4">
              <Link
                href={`/today?date=${iso}`}
                className="inline-flex rounded bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200"
              >
                Go to today →
              </Link>
            </div>
          )}
        </>
      ) : (
        <div>
          <h2 className="text-lg font-semibold text-zinc-300">Rest day</h2>
          <p className="mt-1 text-sm text-zinc-500">No session scheduled.</p>
        </div>
      )}
    </div>
  );
}

// ── DayView ───────────────────────────────────────────────────────────────────

export interface DayViewProps {
  weekStartISO: string;
  snapshot: WeekPlanSnapshot | null;
  loading: boolean;
  selectedDate: string;
  onSelectDate: (iso: string) => void;
}

export function DayView({
  weekStartISO,
  snapshot,
  loading,
  selectedDate,
  onSelectDate,
}: DayViewProps) {
  const today = todayISO();
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStartISO, i));
  const selectedDay = snapshot?.planDays.find((d) => d.date === selectedDate);

  return (
    <div className="space-y-4">
      {/* Day chip selector */}
      <div className="flex gap-1.5">
        {weekDates.map((iso) => {
          const day = snapshot?.planDays.find((d) => d.date === iso);
          return (
            <DayChip
              key={iso}
              iso={iso}
              day={day}
              isSelected={iso === selectedDate}
              isToday={iso === today}
              onClick={() => onSelectDate(iso)}
            />
          );
        })}
      </div>

      {/* Detail card */}
      <DayDetailCard iso={selectedDate} day={selectedDay} loading={loading} />
    </div>
  );
}
