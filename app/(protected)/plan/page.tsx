"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api/client";
import type { PlanDay, WeekPlanSnapshot } from "@/lib/api/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function currentWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

const DAY_ABBREVS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const FOCUS_DESCRIPTIONS: Record<string, string> = {
  triathlon: "Building aerobic base, strength, and multi-sport endurance across swim, bike, and run.",
  hyrox: "Combining functional strength with running capacity for competitive hybrid fitness.",
  strength: "Progressive overload across compound lifts to build total body strength and muscle.",
  half_marathon: "Developing running volume, tempo work, and race-pace intervals for 21.1 km.",
  general_fitness: "Balanced mix of cardio, strength, and mobility to improve overall fitness.",
};

const TYPE_ORDER: Record<string, number> = {
  run: 0,
  bike: 1,
  swim: 2,
  strength: 3,
  hybrid: 4,
  mobility: 5,
  rest: 6,
};

const TYPE_LABELS: Record<string, string> = {
  run: "Run",
  bike: "Bike",
  swim: "Swim",
  strength: "Strength",
  hybrid: "Hybrid",
  mobility: "Mobility",
  rest: "Rest",
};

// ── Sections ──────────────────────────────────────────────────────────────────

function WeeklyFocus({ days, focus }: { days: PlanDay[]; focus: string }) {
  const activeDays = days.filter((d) => d.primary && d.primary.type !== "rest");
  const totalSessions = activeDays.length;
  const totalDuration = activeDays.reduce((s, d) => s + (d.primary?.durationMinutes ?? 0), 0);
  const totalLoad = activeDays.reduce((s, d) => s + (d.primary?.load ?? 0), 0);
  const description = FOCUS_DESCRIPTIONS[focus] ?? "Personalized training plan for this week.";

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
        Weekly Focus
      </h2>
      <p className="mt-2 text-sm text-zinc-300">{description}</p>
      <div className="mt-4 grid grid-cols-3 gap-4">
        {[
          { label: "Total Sessions", value: totalSessions },
          { label: "Total Duration", value: `${totalDuration} min` },
          { label: "Total Load", value: totalLoad.toFixed(0) },
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col gap-0.5">
            <span className="text-xs text-zinc-500">{label}</span>
            <span className="text-lg font-semibold text-zinc-100">{value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function LoadDistribution({ days }: { days: PlanDay[] }) {
  const loads = days.map((d) => d.primary?.load ?? 0);
  const maxLoad = Math.max(...loads, 1);

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-400">
        Load Distribution
      </h2>
      <div className="flex flex-col gap-2">
        {days.map((day, i) => {
          const load = day.primary?.load ?? 0;
          const isRest = !day.primary || day.primary.type === "rest" || load === 0;
          const pct = isRest ? 0 : (load / maxLoad) * 100;
          return (
            <div key={day.date} className="flex items-center gap-3">
              <span className="w-8 shrink-0 text-xs text-zinc-500">{DAY_ABBREVS[i]}</span>
              <div className="flex-1 overflow-hidden rounded-sm bg-zinc-800" style={{ height: "14px" }}>
                {isRest ? (
                  <div className="h-full bg-zinc-700" style={{ width: "3%" }} />
                ) : (
                  <div className="h-full bg-zinc-400" style={{ width: `${pct}%` }} />
                )}
              </div>
              <span className="w-10 shrink-0 text-right text-xs text-zinc-500">
                {isRest ? "—" : load.toFixed(0)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TrainingMix({ days }: { days: PlanDay[] }) {
  const counts: Record<string, number> = {};
  for (const day of days) {
    if (day.primary) {
      counts[day.primary.type] = (counts[day.primary.type] ?? 0) + 1;
    }
  }

  const entries = Object.entries(counts).sort(
    ([a], [b]) => (TYPE_ORDER[a] ?? 99) - (TYPE_ORDER[b] ?? 99),
  );
  const total = entries.reduce((s, [, n]) => s + n, 0);

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-400">
        Training Mix
      </h2>
      <div className="flex flex-col gap-2.5">
        {entries.map(([type, count]) => (
          <div key={type} className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-sm text-zinc-300">
              {TYPE_LABELS[type] ?? type}
            </span>
            <div className="flex-1 overflow-hidden rounded-sm bg-zinc-800" style={{ height: "8px" }}>
              <div
                className="h-full bg-zinc-400"
                style={{ width: `${(count / total) * 100}%` }}
              />
            </div>
            <span className="w-4 shrink-0 text-right text-xs text-zinc-500">{count}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function SessionBreakdown({ days }: { days: PlanDay[] }) {
  type SessionItem = { title: string; durationMinutes: number; targetRpe: number };
  const grouped: Record<string, SessionItem[]> = {};

  for (const day of days) {
    for (const session of [day.primary, day.secondary]) {
      if (!session || session.type === "rest") continue;
      if (!grouped[session.type]) grouped[session.type] = [];
      grouped[session.type].push({
        title: session.title,
        durationMinutes: session.durationMinutes,
        targetRpe: session.targetRpe,
      });
    }
  }

  const entries = Object.entries(grouped).sort(
    ([a], [b]) => (TYPE_ORDER[a] ?? 99) - (TYPE_ORDER[b] ?? 99),
  );

  if (entries.length === 0) return null;

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-400">
        Session Breakdown
      </h2>
      <div className="flex flex-col gap-5">
        {entries.map(([type, sessions]) => (
          <div key={type}>
            <h3 className="mb-2 text-sm font-semibold text-zinc-200">
              {TYPE_LABELS[type] ?? type}
            </h3>
            <ul className="flex flex-col gap-1.5">
              {sessions.map((s, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-md bg-zinc-800 px-3 py-2"
                >
                  <span className="text-sm text-zinc-300">{s.title}</span>
                  <span className="shrink-0 text-xs text-zinc-500">
                    {s.durationMinutes} min · RPE {s.targetRpe}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function CoachStrategy() {
  return (
    <section className="rounded-lg border border-dashed border-zinc-700 bg-zinc-900/50 p-5">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
        Coach Strategy
      </h2>
      <p className="mt-2 text-sm italic text-zinc-600">
        AI explanation of this week&apos;s training rationale will appear here.
      </p>
    </section>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PlanPage() {
  const weekStartISO = currentWeekStart();

  const [snapshot, setSnapshot] = useState<WeekPlanSnapshot | null>(null);
  const [weekLoading, setWeekLoading] = useState(true);
  const [weekError, setWeekError] = useState<string | null>(null);
  const [noWeek, setNoWeek] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  async function createWeek() {
    setCreating(true);
    setCreateError(null);
    try {
      await api.initWeek(weekStartISO);
      setNoWeek(false);
      setRefetchTrigger((n) => n + 1);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create week");
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setWeekLoading(true);
    setWeekError(null);
    setNoWeek(false);

    api
      .getWeek(weekStartISO)
      .then((res) => {
        if (!cancelled) setSnapshot(res.snapshot);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          if (err instanceof ApiError && err.status === 404) {
            setNoWeek(true);
          } else {
            setWeekError(err instanceof Error ? err.message : "Failed to load week plan");
          }
        }
      })
      .finally(() => {
        if (!cancelled) setWeekLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [weekStartISO, refetchTrigger]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Plan</h1>
      <p className="mt-1 text-xs text-zinc-400">Week of {weekStartISO}</p>

      <div className="mt-6 flex flex-col gap-4">
        {weekLoading && <p className="text-sm text-zinc-500">Loading week plan…</p>}

        {!weekLoading && weekError !== null && (
          <p className="text-sm text-red-500">{weekError}</p>
        )}

        {!weekLoading && noWeek && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-base font-semibold text-zinc-50">No week found</p>
            <p className="mt-1 text-sm text-zinc-400">
              Create your plan for this week based on your Settings.
            </p>
            {createError !== null && (
              <p className="mt-2 text-sm text-red-500">{createError}</p>
            )}
            <button
              onClick={() => void createWeek()}
              disabled={creating}
              className="mt-4 rounded bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200 disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create this week"}
            </button>
          </div>
        )}

        {!weekLoading && snapshot !== null && (
          <>
            <WeeklyFocus
              days={snapshot.planDays}
              focus={snapshot.context.constraints.focus}
            />
            <LoadDistribution days={snapshot.planDays} />
            <TrainingMix days={snapshot.planDays} />
            <SessionBreakdown days={snapshot.planDays} />
            <CoachStrategy />
          </>
        )}
      </div>
    </main>
  );
}
