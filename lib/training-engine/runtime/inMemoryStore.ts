import type { CompletedSession, DecisionLog, PlanDay } from "../types";
import type { TrainingStateStore, WeekKey, WeekPlanSnapshot } from "./store";

// ── InMemoryStore ─────────────────────────────────────────────────────────────
//
// Pure storage adapter. No engine calls. Implements TrainingStateStore using
// three Maps keyed by weekStartISO (WeekKey).
//
// Defensive cloning is applied on every read and write so callers cannot
// accidentally mutate internal state.

export class InMemoryStore implements TrainingStateStore {
  private readonly weekSnapshots = new Map<WeekKey, WeekPlanSnapshot>();
  private readonly completedByWeek = new Map<WeekKey, CompletedSession[]>();
  private readonly decisionLogByWeek = new Map<WeekKey, DecisionLog[]>();

  // ── TrainingStateStore ───────────────────────────────────────────────────

  async initWeek(snapshot: WeekPlanSnapshot): Promise<void> {
    const key = snapshot.weekStartISO;
    if (this.weekSnapshots.has(key)) {
      throw new Error(
        `initWeek: a plan already exists for "${key}". ` +
          `Use saveWeekPlan to update an existing week.`,
      );
    }
    this.weekSnapshots.set(key, cloneSnapshot(snapshot));
    this.decisionLogByWeek.set(key, [...snapshot.decisionLog]);
    if (!this.completedByWeek.has(key)) {
      this.completedByWeek.set(key, []);
    }
  }

  async getWeekPlan(weekStartISO: string): Promise<WeekPlanSnapshot | undefined> {
    const snap = this.weekSnapshots.get(weekStartISO);
    return snap === undefined ? undefined : cloneSnapshot(snap);
  }

  async saveWeekPlan(snapshot: WeekPlanSnapshot): Promise<void> {
    const key = snapshot.weekStartISO;
    this.weekSnapshots.set(key, cloneSnapshot(snapshot));
    this.decisionLogByWeek.set(key, [...snapshot.decisionLog]);
  }

  async logCompletedSession(weekStartISO: string, session: CompletedSession): Promise<void> {
    const list = this.completedByWeek.get(weekStartISO) ?? [];
    list.push({ ...session });
    this.completedByWeek.set(weekStartISO, list);
  }

  /**
   * Records that a day was missed by updating planDays in the stored snapshot.
   * Does NOT call any engine logic — that is the runtime's responsibility.
   * The runtime overwrites this with the engine-adjusted plan via saveWeekPlan.
   */
  async markMissed(weekStartISO: string, dateISO: string, _reason?: string): Promise<void> {
    const snap = this.weekSnapshots.get(weekStartISO);
    if (snap === undefined) return;

    const updatedDays: PlanDay[] = snap.planDays.map((day) => {
      if (day.date !== dateISO) return day;
      // Leave already-terminal days alone.
      if (day.status === "missed" || day.status === "completed") return day;
      return { ...day, status: "missed" as const };
    });

    this.weekSnapshots.set(weekStartISO, {
      ...snap,
      planDays: updatedDays,
      updatedAt: new Date().toISOString(),
    });
  }

  async getCompletedSessions(weekStartISO: string): Promise<CompletedSession[]> {
    return [...(this.completedByWeek.get(weekStartISO) ?? [])];
  }

  async getDecisionLog(weekStartISO: string): Promise<DecisionLog[]> {
    return [...(this.decisionLogByWeek.get(weekStartISO) ?? [])];
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createInMemoryStore(): InMemoryStore {
  return new InMemoryStore();
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function cloneSnapshot(snap: WeekPlanSnapshot): WeekPlanSnapshot {
  return {
    ...snap,
    planDays: snap.planDays.map((day) => ({
      ...day,
      primary: day.primary !== undefined ? { ...day.primary } : undefined,
      secondary: day.secondary !== undefined ? { ...day.secondary } : undefined,
    })),
    decisionLog: [...snap.decisionLog],
  };
}
