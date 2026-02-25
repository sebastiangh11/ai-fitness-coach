import { describe, it, expect } from "vitest";
import { createInMemoryStore } from "./inMemoryStore";
import { createTrainingRuntime } from "./runtime";
import type { CompletedSession, PlanContext } from "../types";

// ── Fixture ───────────────────────────────────────────────────────────────────

function mkContext(): PlanContext {
  return {
    constraints: {
      focus: "triathlon",
      timeBudget: {
        monday: 90,
        tuesday: 60,
        wednesday: 90,
        thursday: 60,
        friday: 45,
        saturday: 120,
        sunday: 90,
      },
      equipment: {
        pool: true,
        gym: true,
        bikeTrainer: true,
        outdoorRun: true,
      },
    },
    history: {
      // Zero prior load → ramp cap is skipped; engine produces a full plan.
      last7DayLoad: 0,
      last14DayLoad: 0,
      completedSessions: [],
    },
  };
}

// Monday — deterministic week anchor for all tests.
const WEEK_START = "2026-02-16";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("createTrainingRuntime + InMemoryStore", () => {
  it("1) initWeek persists a plan with 7 days and correct metadata", async () => {
    const runtime = createTrainingRuntime(createInMemoryStore());

    const snapshot = await runtime.initWeek(mkContext(), WEEK_START);

    expect(snapshot.planDays).toHaveLength(7);
    expect(snapshot.weekStartISO).toBe(WEEK_START);
    expect(snapshot.engineVersion).toBe("v1");
    expect(snapshot.createdAt).toBeTruthy();
    expect(snapshot.updatedAt).toBe(snapshot.createdAt);

    // Verify the snapshot is retrievable through the store.
    const retrieved = await runtime.getWeekPlan(WEEK_START);
    expect(retrieved).toBeDefined();
    expect(retrieved!.planDays).toHaveLength(7);
    expect(retrieved!.weekStartISO).toBe(WEEK_START);
  });

  it("2) markMissed marks the target day and only adjusts the next 2 days", async () => {
    const runtime = createTrainingRuntime(createInMemoryStore());
    const original = await runtime.initWeek(mkContext(), WEEK_START);

    // Find the first day that has a planned primary session.
    const target = original.planDays.find((d) => d.primary !== undefined);
    expect(target).toBeDefined();
    const dateISO = target!.date;
    const missedIdx = original.planDays.findIndex((d) => d.date === dateISO);

    // Use an unrecognised reason ("busy") — the runtime gracefully ignores it
    // (toMissReason returns undefined) and the engine applies standard rules only.
    const updated = await runtime.markMissed(WEEK_START, dateISO, "busy");

    // The missed day must be marked as "missed".
    const missedDay = updated.planDays.find((d) => d.date === dateISO);
    expect(missedDay?.status).toBe("missed");

    // Days strictly beyond the 2-day adjustment window must be unchanged.
    for (let i = missedIdx + 3; i < original.planDays.length; i++) {
      expect(updated.planDays[i]).toEqual(original.planDays[i]);
    }

    // The returned snapshot must have an updated timestamp.
    expect(updated.updatedAt).toBeTruthy();

    // The store should return the same adjusted plan on the next read.
    const stored = await runtime.getWeekPlan(WEEK_START);
    expect(stored?.planDays.find((d) => d.date === dateISO)?.status).toBe("missed");
  });

  it("3) adherence summary reflects logged completed sessions", async () => {
    const runtime = createTrainingRuntime(createInMemoryStore());
    const snapshot = await runtime.initWeek(mkContext(), WEEK_START);

    // Find a day with a planned session to simulate completing.
    const target = snapshot.planDays.find((d) => d.primary !== undefined);
    expect(target).toBeDefined();
    const dateISO = target!.date;

    const session: CompletedSession = {
      id: "test-completed-1",
      date: dateISO,
      type: "run",
      durationMinutes: 45,
      rpe: 6,
      load: 270, // 45 × 6
    };
    await runtime.logCompletedSession(WEEK_START, session);

    const summary = await runtime.getAdherenceSummary(WEEK_START);

    expect(summary).toBeDefined();
    expect(summary!.sessionsCompleted).toBeGreaterThanOrEqual(1);
    expect(summary!.completedLoad).toBe(270);
    expect(summary!.adherencePct).toBeGreaterThan(0);
    // Planned load must be positive since the engine generated at least one session.
    expect(summary!.plannedLoad).toBeGreaterThan(0);
  });
});
