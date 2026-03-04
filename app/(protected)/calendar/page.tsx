"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api/client";
import type { WeekPlanSnapshot, AdherenceSummary } from "@/lib/api/types";
import {
  addDays,
  addWeeks,
  formatISODate,
  formatMonthLabel,
  formatWeekRange,
  monthGridDates,
  parseWeekParam,
  startOfWeekMonday,
  todayISO,
} from "@/lib/calendar/dates";
import MiniMonth from "@/components/calendar/MiniMonth";
import { WeekGrid } from "@/components/calendar/WeekGrid";
import { DayView } from "@/components/calendar/DayView";
import { MonthView } from "@/components/calendar/MonthView";

// ── Types ─────────────────────────────────────────────────────────────────────

type DisplayMode = "day" | "week" | "month";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns the ISO week number (1-53) for the Monday ISO string.
 * Uses the standard ISO 8601 algorithm (week containing Thursday).
 */
function isoWeekNumber(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

const MESOCYCLE_PHASES = ["Base", "Build", "Peak", "Recovery"] as const;

/** Return all unique Monday ISO strings for the calendar grid of a given month. */
function weeksInMonth(year: number, month: number): string[] {
  const dates = monthGridDates(year, month);
  const seen = new Set<string>();
  const weeks: string[] = [];
  for (const iso of dates) {
    const monday = startOfWeekMonday(iso);
    if (!seen.has(monday)) {
      seen.add(monday);
      weeks.push(monday);
    }
  }
  return weeks;
}

/** Derive the display month anchor from the week's Wednesday (prevents edge flipping). */
function monthFromWeek(weekStart: string): [number, number] {
  const anchor = addDays(weekStart, 2);
  const [y, m] = anchor.split("-").map(Number);
  return [y, m];
}

// ── Inner page (reads searchParams) ──────────────────────────────────────────

function CalendarInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const today = todayISO();
  const thisWeek = startOfWeekMonday(today);

  // Derive weekStart from URL; normalize to Monday; fall back to this week.
  const rawParam = searchParams.get("weekStartISO");
  const weekStart = parseWeekParam(rawParam) ?? thisWeek;

  // If the raw param was non-Monday, replace URL silently.
  useEffect(() => {
    if (rawParam !== null && rawParam !== weekStart) {
      router.replace(`/calendar?weekStartISO=${weekStart}`);
    }
  }, [rawParam, weekStart, router]);

  // View mode
  const [displayMode, setDisplayMode] = useState<DisplayMode>("week");

  // Selected date for day view — default to today if in current week, else weekStart
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const weekDates = Array.from({ length: 7 }, (_, i) => addDays(thisWeek, i));
    return weekDates.includes(today) ? today : thisWeek;
  });

  // Keep selectedDate in sync when weekStart changes (day mode navigation)
  useEffect(() => {
    if (displayMode !== "day") return;
    const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    // If the current selectedDate is already in this week, keep it; otherwise reset
    if (!weekDates.includes(selectedDate)) {
      setSelectedDate(weekDates.includes(today) ? today : weekStart);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, displayMode]);

  // Derived month for month view
  const [anchorYear, anchorMonth] = monthFromWeek(weekStart);

  // Per-week fetch state
  const [snapshots, setSnapshots] = useState<Record<string, WeekPlanSnapshot | null>>({});
  const [loadingWeeks, setLoadingWeeks] = useState<Set<string>>(new Set());
  const [noWeeks, setNoWeeks] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Adherence (completed load) — only fetched in day/week mode
  const [adherence, setAdherence] = useState<AdherenceSummary | null>(null);
  const [adherenceLoading, setAdherenceLoading] = useState(false);

  useEffect(() => {
    if (displayMode === "month") {
      setAdherence(null);
      return;
    }
    setAdherence(null);
    setAdherenceLoading(true);
    api
      .getAdherence(weekStart)
      .then((res) => setAdherence(res.summary))
      .catch(() => setAdherence(null))
      .finally(() => setAdherenceLoading(false));
  }, [weekStart, displayMode]);

  // Derive which weeks to fetch
  const weeksToFetch: string[] =
    displayMode === "month"
      ? weeksInMonth(anchorYear, anchorMonth)
      : [weekStart];

  const fetchWeek = useCallback(async (weekISO: string) => {
    setLoadingWeeks((prev) => new Set(prev).add(weekISO));
    setNoWeeks((prev) => {
      const next = new Set(prev);
      next.delete(weekISO);
      return next;
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next[weekISO];
      return next;
    });
    setSnapshots((prev) => ({ ...prev, [weekISO]: null }));
    try {
      const res = await api.getWeek(weekISO);
      setSnapshots((prev) => ({ ...prev, [weekISO]: res.snapshot }));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setNoWeeks((prev) => new Set(prev).add(weekISO));
      } else {
        setErrors((prev) => ({
          ...prev,
          [weekISO]: err instanceof Error ? err.message : "Failed to load week",
        }));
      }
    } finally {
      setLoadingWeeks((prev) => {
        const next = new Set(prev);
        next.delete(weekISO);
        return next;
      });
    }
  }, []);

  // Fetch whenever displayed weeks change
  useEffect(() => {
    for (const w of weeksToFetch) {
      void fetchWeek(w);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, displayMode, fetchWeek]);

  async function createThisWeek() {
    setCreating(true);
    setCreateError(null);
    try {
      await api.initWeek(weekStart);
      await fetchWeek(weekStart);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create week");
    } finally {
      setCreating(false);
    }
  }

  function navigate(weekISO: string) {
    router.push(`/calendar?weekStartISO=${weekISO}`);
  }

  // Navigation action depends on display mode
  function navigatePrev() {
    if (displayMode === "day") {
      const prev = addDays(selectedDate, -1);
      const prevWeek = startOfWeekMonday(prev);
      setSelectedDate(prev);
      if (prevWeek !== weekStart) navigate(prevWeek);
    } else if (displayMode === "month") {
      const firstOfPrevMonth = new Date(anchorYear, anchorMonth - 2, 1);
      navigate(startOfWeekMonday(formatISODate(firstOfPrevMonth)));
    } else {
      navigate(addWeeks(weekStart, -1));
    }
  }

  function navigateNext() {
    if (displayMode === "day") {
      const next = addDays(selectedDate, 1);
      const nextWeek = startOfWeekMonday(next);
      setSelectedDate(next);
      if (nextWeek !== weekStart) navigate(nextWeek);
    } else if (displayMode === "month") {
      const firstOfNextMonth = new Date(anchorYear, anchorMonth, 1);
      navigate(startOfWeekMonday(formatISODate(firstOfNextMonth)));
    } else {
      navigate(addWeeks(weekStart, 1));
    }
  }

  const snapshot = snapshots[weekStart] ?? null;
  const isLoading = loadingWeeks.has(weekStart);
  const anyMonthLoading = weeksToFetch.some((w) => loadingWeeks.has(w));
  const isThisWeek = weekStart === thisWeek;

  // Mesocycle context (4-week rolling cycle)
  const weekInCycle = ((isoWeekNumber(weekStart) - 1) % 4) + 1;
  const phaseLabel = MESOCYCLE_PHASES[weekInCycle - 1];

  // Load bar values
  const plannedLoad = snapshot?.planDays.reduce(
    (sum, d) => sum + (d.primary?.load ?? 0),
    0,
  ) ?? 0;
  const completedLoad = adherence?.completedLoad ?? 0;
  const loadPct = plannedLoad > 0 ? Math.min(100, (completedLoad / plannedLoad) * 100) : 0;

  // Subtitle changes per mode
  const subtitle =
    displayMode === "month"
      ? formatMonthLabel(anchorYear, anchorMonth)
      : displayMode === "day"
        ? (() => {
            const [y, m, d] = selectedDate.split("-").map(Number);
            return new Date(y, m - 1, d).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            });
          })()
        : formatWeekRange(weekStart);

  // Week-level error/no-week states (only relevant in day/week mode)
  const weekError = errors[weekStart];
  const missing = noWeeks.has(weekStart);

  return (
    <div className="flex min-h-screen">
      {/* ── Left panel: mini month picker ── */}
      <div className="hidden w-64 shrink-0 border-r border-zinc-800 px-5 py-8 lg:block">
        <MiniMonth
          selectedWeekStart={weekStart}
          onSelectWeek={(w) => navigate(w)}
          selectedDate={displayMode === "day" ? selectedDate : undefined}
          onSelectDate={(iso) => {
            if (displayMode === "day") setSelectedDate(iso);
          }}
        />
      </div>

      {/* ── Main content ── */}
      <main className="flex-1 min-w-0 px-6 py-8">
        {/* Header */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-50">Calendar</h1>
            <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p>
            {/* Training phase + mesocycle week — day/week mode only */}
            {displayMode !== "month" && snapshot !== null && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-600">
                <span>Training Phase:</span>
                <span className="font-medium text-zinc-500">{phaseLabel}</span>
                <span className="text-zinc-700">·</span>
                <span>Week {weekInCycle} of 4</span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Day / Week / Month toggle */}
            <div className="flex overflow-hidden rounded border border-zinc-700">
              {(["day", "week", "month"] as const).map((mode, i) => (
                <button
                  key={mode}
                  onClick={() => setDisplayMode(mode)}
                  className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                    i > 0 ? "border-l border-zinc-700" : ""
                  } ${
                    displayMode === mode
                      ? "bg-zinc-700 text-zinc-100"
                      : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>

            {/* This week (hidden in month mode) */}
            {displayMode !== "month" && !isThisWeek && (
              <button
                onClick={() => navigate(thisWeek)}
                disabled={isLoading}
                className="rounded border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-50 transition-colors"
              >
                Today
              </button>
            )}

            {/* Prev / Next */}
            <div className="flex items-center">
              <button
                onClick={navigatePrev}
                disabled={anyMonthLoading}
                className="rounded-l border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 transition-colors"
                aria-label="Previous"
              >
                ←
              </button>
              <button
                onClick={navigateNext}
                disabled={anyMonthLoading}
                className="rounded-r border border-l-0 border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 transition-colors"
                aria-label="Next"
              >
                →
              </button>
            </div>
          </div>
        </div>

        {/* ── Weekly Load bar (day/week mode, when a plan exists) ── */}
        {displayMode !== "month" && (snapshot !== null || isLoading) && (
          <div className="mb-6 rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-600">
                Weekly Load
              </span>
              <span className="text-xs tabular-nums text-zinc-500">
                {adherenceLoading || isLoading ? (
                  <span className="inline-block h-3 w-16 animate-pulse rounded bg-zinc-800" />
                ) : plannedLoad > 0 ? (
                  <>
                    <span className="font-medium text-zinc-300">
                      {Math.round(completedLoad).toLocaleString()}
                    </span>
                    <span className="text-zinc-600">
                      {" / "}
                      {Math.round(plannedLoad).toLocaleString()}
                    </span>
                  </>
                ) : (
                  <span className="text-zinc-700">—</span>
                )}
              </span>
            </div>
            {/* Bar */}
            <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-800">
              {isLoading || adherenceLoading ? (
                <div className="h-full w-1/3 animate-pulse rounded-full bg-zinc-700" />
              ) : (
                <div
                  className="h-full rounded-full bg-blue-500/70 transition-all duration-700"
                  style={{ width: `${loadPct}%` }}
                />
              )}
            </div>
          </div>
        )}

        {/* ── Month view ── */}
        {displayMode === "month" && (
          <MonthView
            year={anchorYear}
            month={anchorMonth}
            snapshots={snapshots}
            loadingWeeks={loadingWeeks}
          />
        )}

        {/* ── Day view ── */}
        {displayMode === "day" && (
          <>
            {/* Error */}
            {!isLoading && weekError !== undefined && (
              <div className="mb-4 rounded-lg border border-red-900 bg-red-900/20 p-4">
                <p className="text-sm text-red-400">{weekError}</p>
                <button
                  onClick={() => void fetchWeek(weekStart)}
                  className="mt-2 text-xs text-red-400 underline hover:text-red-300"
                >
                  Retry
                </button>
              </div>
            )}
            {/* No plan */}
            {!isLoading && missing && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
                <p className="text-sm font-semibold text-zinc-200">No plan for this week yet</p>
                <p className="mt-1 text-sm text-zinc-500">
                  Create a plan based on your Settings, then come back here.
                </p>
                {createError !== null && (
                  <p className="mt-2 text-xs text-red-400">{createError}</p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => void createThisWeek()}
                    disabled={creating}
                    className="rounded bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200 disabled:opacity-50 transition-colors"
                  >
                    {creating ? "Creating…" : "Create this week"}
                  </button>
                  <button
                    onClick={() => navigate(thisWeek)}
                    className="rounded border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
                  >
                    Go to this week
                  </button>
                </div>
              </div>
            )}
            {/* Day view */}
            {(isLoading || (!missing && weekError === undefined)) && (
              <DayView
                weekStartISO={weekStart}
                snapshot={snapshot}
                loading={isLoading}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />
            )}
          </>
        )}

        {/* ── Week view ── */}
        {displayMode === "week" && (
          <div>
            {/* Error */}
            {!isLoading && weekError !== undefined && (
              <div className="rounded-lg border border-red-900 bg-red-900/20 p-4">
                <p className="text-sm text-red-400">{weekError}</p>
                <button
                  onClick={() => void fetchWeek(weekStart)}
                  className="mt-2 text-xs text-red-400 underline hover:text-red-300"
                >
                  Retry
                </button>
              </div>
            )}

            {/* No plan */}
            {!isLoading && missing && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
                <p className="text-sm font-semibold text-zinc-200">No plan for this week yet</p>
                <p className="mt-1 text-sm text-zinc-500">
                  Create a plan based on your Settings, then come back here.
                </p>
                {createError !== null && (
                  <p className="mt-2 text-xs text-red-400">{createError}</p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => void createThisWeek()}
                    disabled={creating}
                    className="rounded bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200 disabled:opacity-50 transition-colors"
                  >
                    {creating ? "Creating…" : "Create this week"}
                  </button>
                  <button
                    onClick={() => navigate(thisWeek)}
                    className="rounded border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
                  >
                    Go to this week
                  </button>
                </div>
              </div>
            )}

            {/* Week grid */}
            {(isLoading || (!missing && weekError === undefined)) && (
              <WeekGrid weekStartISO={weekStart} snapshot={snapshot} loading={isLoading} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ── Page export (wraps inner in Suspense for useSearchParams) ─────────────────

import { Suspense } from "react";

export default function CalendarPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-sm text-zinc-500">Loading…</p>
        </div>
      }
    >
      <CalendarInner />
    </Suspense>
  );
}
