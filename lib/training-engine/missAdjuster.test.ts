import { describe, it, expect } from "vitest";
import { adjustAfterMiss } from "./adjusters/missAdjuster";
import type { PlanContext, PlanDay } from "./types";

// ── Builders ────────────────────────────────────────────────────────────────

function mkContext(): PlanContext {
  return {
    constraints: {
      focus: "triathlon",
      timeBudget: {
        monday: 45,
        tuesday: 60,
        wednesday: 45,
        thursday: 60,
        friday: 30,
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
      last7DayLoad: 800,
      last14DayLoad: 1500,
      completedSessions: [],
    },
    readinessToday: {
      date: "2026-02-16",
      readiness: 4,
    },
  };
}

function mkDay(
  date: string,
  intensity: "easy" | "moderate" | "hard",
  priority: 1 | 2 | 3,
  duration = 45,
  rpe = 8,
  title = "Session"
): PlanDay {
  return {
    date,
    status: "planned",
    primary: {
      id: `${title.toLowerCase().replace(/\s+/g, "-")}-${date}`,
      date,
      type: "run",
      title,
      durationMinutes: duration,
      targetRpe: rpe,
      intensity,
      priority,
      load: duration * rpe,
    },
  };
}

function mkWeek(): PlanDay[] {
  return [
    mkDay("2026-02-16", "hard", 1, 45, 8, "Interval Run"),
    mkDay("2026-02-17", "hard", 2, 40, 8, "Tempo Run"),
    mkDay("2026-02-18", "easy", 2, 45, 4, "Easy Swim"),
    { date: "2026-02-19", status: "planned" },
    { date: "2026-02-20", status: "planned" },
    { date: "2026-02-21", status: "planned" },
    { date: "2026-02-22", status: "planned" },
  ];
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("adjustAfterMiss", () => {
  it("A) injury miss forces rest on next day then easy on day+2", () => {
    const plan = mkWeek();
    const result = adjustAfterMiss(mkContext(), plan, {
      dateISO: "2026-02-16",
      kind: "missed",
      reason: "injury",
    });

    const day16 = result.plan.find((d) => d.date === "2026-02-16");
    const day17 = result.plan.find((d) => d.date === "2026-02-17");
    const day18 = result.plan.find((d) => d.date === "2026-02-18");

    expect(day16?.status).toBe("missed");
    expect(day17?.primary).toBeUndefined();
    expect(day18?.primary).toBeDefined();
    expect(day18?.primary?.intensity).toBe("easy");
    expect(result.decisionLog.some((e) => e.severity === "warning")).toBe(true);

    // Day+2 log entry should include previous→new duration and RPE
    const day18Log = result.decisionLog.find(
      (e) => e.rule === "miss_adjuster_injury" && e.message.includes("2026-02-18"),
    );
    expect(day18Log).toBeDefined();
    expect(day18Log?.message).toMatch(/duration \d+ → \d+ min/);
    expect(day18Log?.message).toMatch(/RPE \d+ → \d+/);
  });

  it("B) missed hard session is NOT crammed into next day", () => {
    const plan = mkWeek();
    const result = adjustAfterMiss(mkContext(), plan, {
      dateISO: "2026-02-16",
      kind: "missed",
      reason: "fatigue",
    });

    const day17 = result.plan.find((d) => d.date === "2026-02-17");
    const day17StillHard =
      day17?.primary !== undefined && day17.primary.intensity === "hard";

    expect(day17StillHard).toBe(false);
    expect(result.decisionLog.length).toBeGreaterThan(0);

    // Downgrade log should include previous→new RPE and duration
    const downgradeLog = result.decisionLog.find(
      (e) => e.rule === "miss_adjuster_hard_missed" && e.message.includes("2026-02-17"),
    );
    expect(downgradeLog).toBeDefined();
    expect(downgradeLog?.message).toMatch(/RPE \d+ → \d+/);
    expect(downgradeLog?.message).toMatch(/duration \d+ → \d+ min/);
  });

  it("D) fatigue with easy/moderate miss reduces next-day duration and logs old→new values", () => {
    const plan: PlanDay[] = [
      mkDay("2026-02-16", "easy", 2, 45, 4, "Easy Run"), // missed easy session
      mkDay("2026-02-17", "moderate", 2, 60, 6, "Moderate Bike"),
      { date: "2026-02-18", status: "planned" },
      { date: "2026-02-19", status: "planned" },
      { date: "2026-02-20", status: "planned" },
      { date: "2026-02-21", status: "planned" },
      { date: "2026-02-22", status: "planned" },
    ];

    const result = adjustAfterMiss(mkContext(), plan, {
      dateISO: "2026-02-16",
      kind: "missed",
      reason: "fatigue",
    });

    const day17 = result.plan.find((d) => d.date === "2026-02-17");
    expect(day17?.primary?.durationMinutes).toBeLessThan(60);

    const fatigueLog = result.decisionLog.find((e) => e.rule === "miss_adjuster_fatigue");
    expect(fatigueLog).toBeDefined();
    // Message should say "from 60 to <reduced> min"
    expect(fatigueLog?.message).toMatch(/from 60 to \d+ min/);
    // Load before/after should appear
    expect(fatigueLog?.message).toMatch(/load \d+ → \d+/);
  });

  it("C) does not mutate the original plan", () => {
    const plan = mkWeek();
    const snapshot = JSON.stringify(plan);

    adjustAfterMiss(mkContext(), plan, {
      dateISO: "2026-02-16",
      kind: "missed",
      reason: "fatigue",
    });

    expect(JSON.stringify(plan)).toBe(snapshot);
  });
});
