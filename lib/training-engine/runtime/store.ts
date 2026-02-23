import type { PlanContext, PlanDay, DecisionLog, CompletedSession } from "../types";

// ── Aliases ─────────────────────────────────────────────────────────────────

/** ISO date string representing the Monday that starts a training week (YYYY-MM-DD). */
export type WeekKey = string;

// ── Snapshot ─────────────────────────────────────────────────────────────────

/**
 * Immutable record of a generated (or updated) week plan stored by the
 * persistence layer. All fields required so the snapshot is self-contained.
 */
export interface WeekPlanSnapshot {
  weekStartISO: string;
  context: PlanContext;
  planDays: PlanDay[];
  decisionLog: DecisionLog[];
  /** ISO timestamp – first time this week was persisted. */
  createdAt: string;
  /** ISO timestamp – last time this week was modified. */
  updatedAt: string;
  /** Semver string of the engine that produced this plan. */
  engineVersion: string;
}

// ── Store Contract ───────────────────────────────────────────────────────────

/**
 * Storage contract that every persistence backend must implement.
 *
 * Implementations may be synchronous (in-memory) or asynchronous (DB) –
 * the interface is intentionally synchronous here so the in-memory adapter
 * remains a drop-in; async adapters can wrap with async/await at the call site
 * once a real backend is introduced.
 *
 * Rules:
 *  - No `any` types.
 *  - Methods must not throw on missing keys – return `undefined` instead.
 *  - Implementations own defensive cloning; callers must not mutate returned
 *    objects.
 */
export interface TrainingStateStore {
  /**
   * Persist a freshly generated week for the first time.
   * Throws if a snapshot for `snapshot.weekStartISO` already exists.
   */
  initWeek(snapshot: WeekPlanSnapshot): void;

  /**
   * Return the stored snapshot for a week, or `undefined` if not found.
   */
  getWeekPlan(weekStartISO: string): WeekPlanSnapshot | undefined;

  /**
   * Overwrite the snapshot for an existing week (e.g. after an adjustment).
   * Implementations should update `updatedAt`.
   */
  saveWeekPlan(snapshot: WeekPlanSnapshot): void;

  /**
   * Append a completed session record to the given week's log.
   */
  logCompletedSession(weekStartISO: string, session: CompletedSession): void;

  /**
   * Record that a day was missed.
   * @param reason  Optional free-text reason surfaced to the athlete.
   */
  markMissed(weekStartISO: string, dateISO: string, reason?: string): void;

  /**
   * Return all completed sessions recorded for the given week.
   * Returns an empty array when the week is not found.
   */
  getCompletedSessions(weekStartISO: string): CompletedSession[];

  /**
   * Return the decision log entries for the given week.
   * Returns an empty array when the week is not found.
   */
  getDecisionLog(weekStartISO: string): DecisionLog[];
}
