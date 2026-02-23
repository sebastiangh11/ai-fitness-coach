import { describe, it, expect } from "vitest";
import { summarizeAdherence, mapCompletedByDate } from "./adherence";
import type { PlanDay, CompletedSession } from "../types";

// ── Builders ────────────────────────────────────────────────────────────────

function mkPlannedDay(
  date: string,
  load: number,
  status: PlanDay["status"] = "planned"
): PlanDay {
  return {
    date,
    status,
    primary: {
      id: `session-${date}`,
      date,
      type: "run",
      title: "Session",
      durationMinutes: 45,
      targetRpe: 6,
      intensity: "moderate",
      priority: 2,
      load,
    },
  };
}

function mkCompleted(date: string, load: number): CompletedSession {
  return {
    id: `completed-${date}-${load}`,
    date,
    type: "run",
    durationMinutes: 45,
    rpe: 6,
    load,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("summarizeAdherence", () => {
  it("1) returns 0 adherence when plannedLoad is 0", () => {
    const plan: PlanDay[] = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-02-${String(16 + i).padStart(2, "0")}`,
      status: "planned" as const,
    }));
    const completed = [mkCompleted("2026-02-16", 200)];

    const result = summarizeAdherence(plan, completed);

    expect(result.adherencePct).toBe(0);
    expect(result.plannedLoad).toBe(0);
    expect(result.completedLoad).toBe(200);
  });

  it("2) computes adherence percentage from loads", () => {
    const plan: PlanDay[] = [
      mkPlannedDay("2026-02-16", 100),
      mkPlannedDay("2026-02-17", 200),
      { date: "2026-02-18", status: "planned" },
    ];
    const completed = [
      mkCompleted("2026-02-16", 150),
      mkCompleted("2026-02-17", 150),
    ];

    const result = summarizeAdherence(plan, completed);

    expect(result.plannedLoad).toBe(300);
    expect(result.completedLoad).toBe(300);
    expect(result.adherencePct).toBe(100);
    expect(result.sessionsPlanned).toBe(2);
    expect(result.sessionsCompleted).toBe(2);
    expect(result.sessionsMissed).toBe(0);
  });

  it("3) counts missed sessions and caps over-training at 150", () => {
    const plan: PlanDay[] = [
      mkPlannedDay("2026-02-16", 100),
      mkPlannedDay("2026-02-17", 100, "missed"),
    ];
    const completed = [mkCompleted("2026-02-16", 400)];

    const result = summarizeAdherence(plan, completed);

    expect(result.plannedLoad).toBe(200);
    expect(result.completedLoad).toBe(400);
    expect(result.adherencePct).toBe(150);
    expect(result.sessionsMissed).toBe(1);
  });
});

describe("mapCompletedByDate", () => {
  it("4) groups completed sessions by date", () => {
    const completed = [
      mkCompleted("2026-02-16", 100),
      mkCompleted("2026-02-16", 80),
      mkCompleted("2026-02-17", 120),
    ];

    const map = mapCompletedByDate(completed);

    expect(map["2026-02-16"]).toHaveLength(2);
    expect(map["2026-02-17"]).toHaveLength(1);
    expect(Object.keys(map)).toHaveLength(2);
  });
});
