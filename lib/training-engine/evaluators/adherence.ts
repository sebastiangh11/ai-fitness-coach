import type { PlanDay, CompletedSession } from "../types";

export interface AdherenceSummary {
  plannedLoad: number;
  completedLoad: number;
  adherencePct: number; // 0..150
  sessionsPlanned: number;
  sessionsCompleted: number;
  sessionsMissed: number;
}

export function mapCompletedByDate(
  completed: CompletedSession[]
): Record<string, CompletedSession[]> {
  const map: Record<string, CompletedSession[]> = {};
  for (const session of completed) {
    const key = session.date;
    if (map[key] === undefined) {
      map[key] = [];
    }
    map[key].push(session);
  }
  return map;
}

export function summarizeAdherence(
  plan: PlanDay[],
  completed: CompletedSession[]
): AdherenceSummary {
  const plannedLoad = plan.reduce(
    (sum, day) => sum + (day.primary?.load ?? 0),
    0
  );
  const sessionsPlanned = plan.filter((day) => day.primary !== undefined).length;
  const sessionsMissed = plan.filter((day) => day.status === "missed").length;

  const completedLoad = completed.reduce((sum, s) => sum + s.load, 0);

  const planDates = new Set(plan.map((day) => day.date));
  const sessionsCompleted = completed.filter((s) => planDates.has(s.date)).length;

  const adherencePct =
    plannedLoad === 0
      ? 0
      : Math.min(150, Math.max(0, (completedLoad / plannedLoad) * 100));

  return {
    plannedLoad,
    completedLoad,
    adherencePct,
    sessionsPlanned,
    sessionsCompleted,
    sessionsMissed,
  };
}
