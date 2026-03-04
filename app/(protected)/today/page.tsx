"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api/client";
import type {
  PlanDay,
  DecisionLog,
  WeekPlanSnapshot,
  AdherenceSummary,
} from "@/lib/api/types";
import { getCoachInsight } from "@/lib/insights/coachInsight";
import type { CoachInsightInput } from "@/lib/insights/coachInsight";

type PrimarySession = NonNullable<PlanDay["primary"]>;

// ── Date helpers ──────────────────────────────────────────────────────────────

function thisWeekStartISO(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, "0");
  const d = String(monday.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function nextDayISO(iso: string): string {
  const [y, mo, d] = iso.split("-").map(Number);
  const date = new Date(y, mo - 1, d + 1);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatLocalDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function greeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  if (h >= 17 && h < 22) return "Good evening";
  return "Good night";
}

// ── Computed helpers ──────────────────────────────────────────────────────────

function computeStreak(planDays: PlanDay[], today: string): number {
  const past = planDays
    .filter((d) => d.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  let streak = 0;
  for (let i = past.length - 1; i >= 0; i--) {
    const d = past[i];
    if (!d.primary) continue; // rest day — skip but don't break
    if (d.status === "completed") {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

function getRecoveryStatus(
  adherence: AdherenceSummary,
  planDay: PlanDay | null,
): string {
  const s = planDay?.primary;
  const done =
    planDay?.status === "completed" || planDay?.status === "modified";
  if (done && s?.intensity === "hard") return "Recovery needed";
  if (planDay?.status === "missed") return "Rest up";
  if (adherence.adherencePct > 80) return "Excellent";
  if (adherence.adherencePct > 50) return "On track";
  return "Building";
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  planned: "bg-blue-900/30 text-blue-300 ring-blue-700",
  completed: "bg-green-900/30 text-green-300 ring-green-700",
  missed: "bg-red-900/30 text-red-300 ring-red-700",
  modified: "bg-amber-900/30 text-amber-300 ring-amber-700",
};

function StatusBadge({ status }: { status: string }) {
  const cls =
    STATUS_STYLES[status] ?? "bg-zinc-800 text-zinc-300 ring-zinc-700";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}
    >
      {status}
    </span>
  );
}

// ── Log form ──────────────────────────────────────────────────────────────────

interface LogFormProps {
  primary: PrimarySession;
  weekStart: string;
  date: string;
  onSuccess: () => void;
}

function LogForm({ primary, weekStart, date, onSuccess }: LogFormProps) {
  const [duration, setDuration] = useState(primary.durationMinutes);
  const [rpe, setRpe] = useState(primary.targetRpe);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.BaseSyntheticEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      await api.logSession({
        weekStartISO: weekStart,
        session: {
          date,
          type: primary.type,
          durationMinutes: duration,
          rpe,
          ...(notes.trim() !== "" ? { notes: notes.trim() } : {}),
        },
      });
      setSuccess(true);
      onSuccess();
    } catch (err) {
      setSubmitError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to log session",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <p className="text-sm font-medium text-green-400">
        Session logged successfully.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">Duration (min)</span>
          <input
            type="number"
            min={1}
            max={600}
            required
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">RPE (1–10)</span>
          <input
            type="number"
            min={1}
            max={10}
            required
            value={rpe}
            onChange={(e) => setRpe(Number(e.target.value))}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-zinc-500">Notes (optional)</span>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
        />
      </label>
      {submitError && <p className="text-xs text-red-400">{submitError}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-zinc-50 px-4 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-200 disabled:opacity-50"
      >
        {submitting ? "Logging…" : "Log session"}
      </button>
    </form>
  );
}

// ── Mark missed form ──────────────────────────────────────────────────────────

interface MarkMissedFormProps {
  weekStart: string;
  date: string;
  onSuccess: () => void;
}

function MarkMissedForm({ weekStart, date, onSuccess }: MarkMissedFormProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.BaseSyntheticEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.markMissed(
        weekStart,
        date,
        reason.trim() !== "" ? reason.trim() : undefined,
      );
      setDone(true);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark missed");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) return <p className="text-sm text-zinc-500">Marked as missed.</p>;

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-zinc-500">Reason (optional)</span>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. travel, injury…"
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
        />
      </label>
      <p className="text-xs text-zinc-500">This will adjust the next 2 days.</p>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
      >
        {submitting ? "Marking…" : "Mark missed"}
      </button>
    </form>
  );
}

// ── Today's Session Hero Card ─────────────────────────────────────────────────

interface SessionCardProps {
  day: PlanDay;
  weekStart: string;
  date: string;
  onLogged: () => void;
  onStatusChanged: () => void;
}

function SessionCard({
  day,
  weekStart,
  date,
  onLogged,
  onStatusChanged,
}: SessionCardProps) {
  const [reverting, setReverting] = useState(false);
  const [revertError, setRevertError] = useState<string | null>(null);
  const [showLogForm, setShowLogForm] = useState(false);
  const [showMissedForm, setShowMissedForm] = useState(false);
  const [optimisticStatus, setOptimisticStatus] = useState<string | null>(null);
  const effectiveStatus = optimisticStatus ?? day.status;

  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (optimisticStatus === null) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 700);
    return () => clearTimeout(t);
  }, [optimisticStatus]);

  function handleSessionLogged() {
    setOptimisticStatus("completed");
    setShowLogForm(false);
    onLogged();
  }

  function handleSessionMissed() {
    setOptimisticStatus("missed");
    setShowMissedForm(false);
    onLogged();
  }

  async function revertToPlanned() {
    setReverting(true);
    setRevertError(null);
    try {
      await api.setStatus(weekStart, date, "planned");
      setOptimisticStatus("planned");
      onStatusChanged();
    } catch (err) {
      setRevertError(err instanceof Error ? err.message : "Failed to revert");
    } finally {
      setReverting(false);
    }
  }

  const s = day.primary;

  if (!s) {
    return (
      <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-6">
        <p className="text-sm text-zinc-400">Rest day — no session scheduled.</p>
        <div className="mt-2">
          <StatusBadge status={day.status} />
        </div>
      </div>
    );
  }

  const flashRing =
    optimisticStatus === "completed"
      ? "ring-2 ring-green-500/25"
      : optimisticStatus === "missed"
        ? "ring-2 ring-red-500/25"
        : optimisticStatus === "planned"
          ? "ring-2 ring-blue-500/25"
          : "";

  return (
    <div
      className={`rounded-xl border border-zinc-700 bg-zinc-900 p-6 transition-all duration-500 ${flash ? flashRing : ""}`}
    >
      {/* Type tag + status */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide text-zinc-400">
          {s.type}
        </span>
        <StatusBadge status={effectiveStatus} />
      </div>

      {/* Title */}
      <h3 className="text-2xl font-bold text-zinc-50">{s.title}</h3>

      {/* Metrics row */}
      <div className="mt-3 flex flex-wrap gap-4">
        {[
          { label: "Duration", value: `${s.durationMinutes} min` },
          { label: "RPE", value: String(s.targetRpe) },
          { label: "Load", value: String(s.load) },
          ...(s.intensity ? [{ label: "Intensity", value: s.intensity }] : []),
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col gap-0.5">
            <span className="text-xs text-zinc-500">{label}</span>
            <span className="text-sm font-semibold text-zinc-200">{value}</span>
          </div>
        ))}
      </div>

      {s.description && (
        <p className="mt-4 text-sm text-zinc-500">{s.description}</p>
      )}

      {/* Action area */}
      <div className="mt-5 border-t border-zinc-800 pt-4">
        {effectiveStatus === "planned" && !showLogForm && !showMissedForm && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowLogForm(true)}
              className="rounded-lg bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-200 transition-colors"
            >
              Complete Session
            </button>
            <button
              type="button"
              onClick={() => setShowMissedForm(true)}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              Mark Missed
            </button>
          </div>
        )}

        {effectiveStatus === "planned" && showLogForm && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Log session
              </p>
              <button
                type="button"
                onClick={() => setShowLogForm(false)}
                className="text-xs text-zinc-500 hover:text-zinc-300"
              >
                Cancel
              </button>
            </div>
            <LogForm
              primary={s}
              weekStart={weekStart}
              date={date}
              onSuccess={handleSessionLogged}
            />
          </div>
        )}

        {effectiveStatus === "planned" && showMissedForm && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Mark as missed
              </p>
              <button
                type="button"
                onClick={() => setShowMissedForm(false)}
                className="text-xs text-zinc-500 hover:text-zinc-300"
              >
                Cancel
              </button>
            </div>
            <MarkMissedForm
              weekStart={weekStart}
              date={date}
              onSuccess={handleSessionMissed}
            />
          </div>
        )}

        {(effectiveStatus === "completed" || effectiveStatus === "missed") && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-zinc-400">
              {effectiveStatus === "completed"
                ? "Session completed."
                : "Marked as missed."}
            </p>
            {revertError !== null && (
              <p className="text-xs text-red-400">{revertError}</p>
            )}
            <button
              type="button"
              onClick={() => void revertToPlanned()}
              disabled={reverting}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-50 transition-colors"
            >
              {reverting ? "Reverting…" : "Revert to Planned"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Plan decision feedback ────────────────────────────────────────────────────

const ADJUSTMENT_RULES = new Set([
  "missAdjuster",
  "reduce_duration",
  "downgrade_intensity",
  "rest_enforcement",
  "load_reduction",
  "deload",
  "recovery",
  "adjust",
]);

function isAdjustmentEntry(entry: DecisionLog): boolean {
  if (entry.severity === "warning") return true;
  const rule = entry.rule.toLowerCase();
  for (const keyword of ADJUSTMENT_RULES) {
    if (rule.includes(keyword)) return true;
  }
  return false;
}

function PlanDecisionFeedback({ log }: { log: DecisionLog[] }) {
  const entries = log.filter(isAdjustmentEntry);
  return (
    <div className="rounded-xl border border-amber-800 bg-amber-900/20 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-400">
        Plan updated
      </p>
      {entries.length > 0 ? (
        <ul className="space-y-1">
          {entries.map((entry, i) => (
            <li key={i} className="flex gap-2 text-sm text-amber-300">
              <span className="mt-0.5 shrink-0 text-amber-500">·</span>
              {entry.message}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-amber-400">No adjustments required.</p>
      )}
    </div>
  );
}

// ── AI Coach Insight card ─────────────────────────────────────────────────────

const INSIGHT_CARD_STYLES = {
  neutral: "border-zinc-700 bg-zinc-800/50",
  positive: "border-green-800 bg-green-900/20",
  warning: "border-amber-800 bg-amber-900/20",
} as const;

const INSIGHT_TITLE_STYLES = {
  neutral: "text-zinc-400",
  positive: "text-green-400",
  warning: "text-amber-400",
} as const;

const INSIGHT_MESSAGE_STYLES = {
  neutral: "text-zinc-300",
  positive: "text-green-300",
  warning: "text-amber-300",
} as const;

function CoachInsightCard({ input }: { input: CoachInsightInput }) {
  const { title, lines, tone } = getCoachInsight(input);
  return (
    <div className={`rounded-xl border p-5 ${INSIGHT_CARD_STYLES[tone]}`}>
      <p
        className={`mb-3 text-xs font-semibold uppercase tracking-wide ${INSIGHT_TITLE_STYLES[tone]}`}
      >
        {title}
      </p>
      <div className="space-y-1.5">
        {lines.map((line, i) => (
          <p
            key={i}
            className={`text-sm leading-relaxed ${INSIGHT_MESSAGE_STYLES[tone]}`}
          >
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}

// ── Tomorrow preview card ─────────────────────────────────────────────────────

function TomorrowCard({ day }: { day: PlanDay }) {
  const s = day.primary;
  if (!s) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <p className="text-sm text-zinc-500">Rest day.</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
          {s.type}
        </span>
      </div>
      <p className="text-sm font-semibold text-zinc-200">{s.title}</p>
      <div className="mt-2 flex flex-wrap gap-4">
        {[
          { label: "Duration", value: `${s.durationMinutes} min` },
          { label: "RPE", value: String(s.targetRpe) },
          { label: "Load", value: String(s.load) },
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col gap-0.5">
            <span className="text-xs text-zinc-600">{label}</span>
            <span className="text-sm font-medium text-zinc-400">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Weekly Progress section ───────────────────────────────────────────────────

function WeeklyProgress({ adherence }: { adherence: AdherenceSummary }) {
  const sessionPct =
    adherence.sessionsPlanned > 0
      ? (adherence.sessionsCompleted / adherence.sessionsPlanned) * 100
      : 0;

  const metrics = [
    {
      label: "Sessions Completed",
      value: `${adherence.sessionsCompleted} / ${adherence.sessionsPlanned}`,
    },
    {
      label: "Weekly Load",
      value: `${adherence.completedLoad.toFixed(0)} / ${adherence.plannedLoad.toFixed(0)}`,
    },
    {
      label: "Progress",
      value: `${adherence.adherencePct.toFixed(1)}%`,
    },
  ];

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="grid grid-cols-3 gap-4">
        {metrics.map(({ label, value }) => (
          <div key={label} className="flex flex-col gap-0.5">
            <span className="text-xs text-zinc-500">{label}</span>
            <span className="text-lg font-bold text-zinc-100">{value}</span>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="mt-5">
        <div className="mb-1.5 flex justify-between text-xs text-zinc-600">
          <span>Weekly progress</span>
          <span>{sessionPct.toFixed(0)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-zinc-300 transition-all duration-700"
            style={{ width: `${Math.min(sessionPct, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Performance Snapshot section ──────────────────────────────────────────────

function PerformanceSnapshot({
  planDays,
  today,
  adherence,
  planDay,
}: {
  planDays: PlanDay[];
  today: string;
  adherence: AdherenceSummary;
  planDay: PlanDay | null;
}) {
  const streak = computeStreak(planDays, today);
  const recovery = getRecoveryStatus(adherence, planDay);

  const stats = [
    {
      label: "Training Streak",
      value: streak === 0 ? "0 days" : `${streak} day${streak > 1 ? "s" : ""}`,
      sub: streak === 0 ? "Complete a session to start" : "Keep it going",
    },
    {
      label: "Weekly Load",
      value: adherence.completedLoad.toFixed(0),
      sub: `of ${adherence.plannedLoad.toFixed(0)} planned`,
    },
    {
      label: "Recovery Status",
      value: recovery,
      sub:
        planDay?.status === "completed"
          ? "Based on today's session"
          : "Based on week adherence",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map(({ label, value, sub }) => (
        <div
          key={label}
          className="flex flex-col gap-1 rounded-xl border border-zinc-800 bg-zinc-900 p-4"
        >
          <span className="text-xs text-zinc-500">{label}</span>
          <span className="text-base font-bold text-zinc-100">{value}</span>
          <span className="text-xs text-zinc-600">{sub}</span>
        </div>
      ))}
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
      {children}
    </h2>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const today = todayISO();
  const tomorrow = nextDayISO(today);

  const [snapshot, setSnapshot] = useState<WeekPlanSnapshot | null>(null);
  const [adherence, setAdherence] = useState<AdherenceSummary | null>(null);
  const [adherenceLoading, setAdherenceLoading] = useState(false);
  const [adherenceError, setAdherenceError] = useState<string | null>(null);
  const [noWeek, setNoWeek] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [weekError, setWeekError] = useState<string | null>(null);

  const hasLoadedRef = useRef(false);

  const loadWeek = useCallback(async () => {
    const isFirstLoad = !hasLoadedRef.current;
    if (isFirstLoad) {
      setLoading(true);
      setSnapshot(null);
      setAdherence(null);
      setNoWeek(false);
      setAdherenceError(null);
    }
    setWeekError(null);

    try {
      const res = await api.getWeek();
      hasLoadedRef.current = true;
      setSnapshot(res.snapshot);
      setNoWeek(false);
      setAdherenceLoading(true);
      void api
        .getAdherence(res.snapshot.weekStartISO)
        .then((adh) => setAdherence(adh.summary))
        .catch(() => setAdherenceError("Failed to load adherence"))
        .finally(() => setAdherenceLoading(false));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setNoWeek(true);
      } else {
        setWeekError(err instanceof Error ? err.message : "Failed to load plan");
      }
      throw err;
    } finally {
      if (isFirstLoad) setLoading(false);
    }
  }, []);

  async function createThisWeek() {
    setCreating(true);
    setCreateError(null);
    try {
      await api.initWeek(thisWeekStartISO());
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create week");
      setCreating(false);
      return;
    }
    try {
      await loadWeek();
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setCreateError("Week created but could not be loaded. Try refreshing.");
      }
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    void loadWeek().catch(() => {});
  }, [loadWeek]);

  // Derived
  const planDay = snapshot?.planDays.find((d) => d.date === today) ?? null;
  const tomorrowDay = snapshot?.planDays.find((d) => d.date === tomorrow) ?? null;
  const weekStart = snapshot?.weekStartISO ?? null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 space-y-8">

      {/* ── 1. Greeting Header ── */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50">
          {greeting()}, Sebastian
        </h1>
        <p className="mt-1 text-sm text-zinc-500">{formatLocalDate(today)}</p>
      </div>

      {/* ── Global states ── */}
      {loading && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-sm text-zinc-500">Loading your plan…</p>
        </div>
      )}
      {!loading && weekError !== null && (
        <div className="rounded-xl border border-red-900 bg-red-900/20 p-6">
          <p className="text-sm font-medium text-red-400">{weekError}</p>
          <button
            onClick={loadWeek}
            className="mt-3 rounded-lg border border-red-700 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-900/30 disabled:opacity-50"
          >
            Retry
          </button>
        </div>
      )}
      {!loading && noWeek && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-base font-semibold text-zinc-50">
            No plan for this week yet
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            Create your plan using your Settings.
          </p>
          {createError !== null && (
            <p className="mt-3 text-sm text-red-400">{createError}</p>
          )}
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() => void createThisWeek()}
              disabled={creating}
              className="rounded-lg bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-200 disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create this week"}
            </button>
            <button
              onClick={() => void loadWeek().catch(() => {})}
              disabled={creating}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {snapshot !== null && weekStart !== null && (
        <>
          {/* ── 2. Today's Session (Hero Card) ── */}
          <section className="space-y-3">
            <SectionLabel>Today&apos;s Session</SectionLabel>
            {planDay !== null ? (
              <SessionCard
                day={planDay}
                weekStart={weekStart}
                date={today}
                onLogged={loadWeek}
                onStatusChanged={loadWeek}
              />
            ) : (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                <p className="text-sm font-medium text-zinc-50">
                  No session scheduled today.
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  Check your weekly plan for upcoming sessions.
                </p>
              </div>
            )}
            {planDay?.status === "missed" && (
              <PlanDecisionFeedback log={snapshot.decisionLog} />
            )}
          </section>

          {/* ── 3. AI Coach Insight ── */}
          {planDay !== null && adherence !== null && (
            <CoachInsightCard
              input={{
                focus: snapshot.context.constraints.focus,
                todayStatus:
                  planDay.status === "completed" ? "done" : planDay.status,
                todayIntensity: planDay.primary?.intensity,
                adherencePct: adherence.adherencePct,
                plannedLoad: adherence.plannedLoad,
                completedLoad: adherence.completedLoad,
                sessionsPlanned: adherence.sessionsPlanned,
                sessionsCompleted: adherence.sessionsCompleted,
                sessionsMissed: adherence.sessionsMissed,
              }}
            />
          )}
          {planDay !== null && adherenceLoading && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <p className="text-xs text-zinc-600">Loading coach insight…</p>
            </div>
          )}
          {planDay !== null && adherenceError !== null && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <p className="text-xs text-zinc-500">Coach insight unavailable.</p>
            </div>
          )}

          {/* ── 4. Tomorrow ── */}
          <section className="space-y-3">
            <SectionLabel>Tomorrow</SectionLabel>
            {tomorrowDay !== null ? (
              <TomorrowCard day={tomorrowDay} />
            ) : (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                <p className="text-sm text-zinc-500">
                  No session scheduled for tomorrow.
                </p>
              </div>
            )}
          </section>

          {/* ── 5. Weekly Progress ── */}
          <section className="space-y-3">
            <SectionLabel>Weekly Progress</SectionLabel>
            {adherenceLoading && (
              <p className="text-sm text-zinc-600">Loading…</p>
            )}
            {!adherenceLoading && adherence !== null && (
              <WeeklyProgress adherence={adherence} />
            )}
          </section>

          {/* ── 6. Performance Snapshot ── */}
          {adherence !== null && (
            <section className="space-y-3">
              <SectionLabel>Performance Snapshot</SectionLabel>
              <PerformanceSnapshot
                planDays={snapshot.planDays}
                today={today}
                adherence={adherence}
                planDay={planDay}
              />
            </section>
          )}
        </>
      )}
    </main>
  );
}
