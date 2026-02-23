import type { PlanContext, CompletedSession } from "../types";
import { generateWeek } from "../generators/planGenerator";
import { adjustAfterMiss, type MissReason } from "../adjusters/missAdjuster";
import { summarizeAdherence } from "../evaluators/adherence";
import type { AdherenceSummary } from "../evaluators/adherence";
import type { TrainingStateStore, WeekPlanSnapshot } from "./store";

// ── Options ──────────────────────────────────────────────────────────────────

export type RuntimeOptions = {
  /** Semver label written into every snapshot. Defaults to "v1". */
  engineVersion?: string;
};

// ── Internal helpers ─────────────────────────────────────────────────────────

const VALID_MISS_REASONS: ReadonlySet<string> = new Set<MissReason>([
  "no_time",
  "fatigue",
  "injury",
  "sick",
  "travel",
  "other",
]);

/** Narrows an arbitrary string to MissReason without `any`. */
function toMissReason(value: string | undefined): MissReason | undefined {
  if (value === undefined) return undefined;
  return VALID_MISS_REASONS.has(value) ? (value as MissReason) : undefined;
}

// ── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates a stateless orchestration runtime that coordinates engine calls with
 * store persistence via the TrainingStateStore contract.
 *
 * All side-effects (reads and writes) go through `store`; the runtime itself
 * holds no state.
 */
export function createTrainingRuntime(
  store: TrainingStateStore,
  options?: RuntimeOptions,
) {
  const engineVersion = options?.engineVersion ?? "v1";

  // ── A ────────────────────────────────────────────────────────────────────

  function initWeek(context: PlanContext, weekStartISO: string): WeekPlanSnapshot {
    const result = generateWeek(context, weekStartISO);
    const ts = new Date().toISOString();

    const snapshot: WeekPlanSnapshot = {
      weekStartISO,
      context,
      planDays: result.plan,
      decisionLog: result.decisionLog,
      createdAt: ts,
      updatedAt: ts,
      engineVersion,
    };

    store.initWeek(snapshot);
    return snapshot;
  }

  // ── B ────────────────────────────────────────────────────────────────────

  function getWeekPlan(weekStartISO: string): WeekPlanSnapshot | undefined {
    return store.getWeekPlan(weekStartISO);
  }

  // ── C ────────────────────────────────────────────────────────────────────

  function logCompletedSession(weekStartISO: string, session: CompletedSession): void {
    store.logCompletedSession(weekStartISO, session);
  }

  // ── D ────────────────────────────────────────────────────────────────────

  function markMissed(
    weekStartISO: string,
    dateISO: string,
    reason?: string,
  ): WeekPlanSnapshot {
    const snapshot = store.getWeekPlan(weekStartISO);
    if (snapshot === undefined) {
      throw new Error(
        `markMissed: no week plan found for "${weekStartISO}". ` +
          `Call initWeek first to generate and persist the plan.`,
      );
    }

    // Persist the miss event in the store (audit trail / future queries).
    store.markMissed(weekStartISO, dateISO, reason);

    // Fetch the latest completed sessions to keep context current.
    const completedSessions = store.getCompletedSessions(weekStartISO);

    // Run engine adjustment over the stored planDays.
    const missReason = toMissReason(reason);
    const { plan: adjustedDays, decisionLog: newLogs } = adjustAfterMiss(
      snapshot.context,
      snapshot.planDays,
      {
        dateISO,
        kind: "missed",
        ...(missReason !== undefined ? { reason: missReason } : {}),
      },
      { horizonDays: 2, allowRebalance: false },
    );

    // Merge the latest completed sessions into context history.
    const updatedContext: PlanContext = {
      ...snapshot.context,
      history: {
        ...snapshot.context.history,
        completedSessions,
      },
    };

    // Build the updated snapshot: append new logs, refresh updatedAt.
    const updatedSnapshot: WeekPlanSnapshot = {
      ...snapshot,
      context: updatedContext,
      planDays: adjustedDays,
      decisionLog: [...snapshot.decisionLog, ...newLogs],
      updatedAt: new Date().toISOString(),
    };

    store.saveWeekPlan(updatedSnapshot);
    return updatedSnapshot;
  }

  // ── E ────────────────────────────────────────────────────────────────────

  function getAdherenceSummary(weekStartISO: string): AdherenceSummary | undefined {
    const snapshot = store.getWeekPlan(weekStartISO);
    if (snapshot === undefined) return undefined;

    const completedSessions = store.getCompletedSessions(weekStartISO);
    return summarizeAdherence(snapshot.planDays, completedSessions);
  }

  // ── Public surface ───────────────────────────────────────────────────────

  return {
    initWeek,
    getWeekPlan,
    logCompletedSession,
    markMissed,
    getAdherenceSummary,
  };
}
