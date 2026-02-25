import {
  generateWeek,
  adjustAfterMiss,
  summarizeAdherence,
  computeLoad,
} from "../lib/training-engine";
import type {
  PlanContext,
  PlanDay,
  CompletedSession,
  MissEvent,
} from "../lib/training-engine";

// ── Fixture ───────────────────────────────────────────────────────────────────

const WEEK_START_ISO = "2026-02-16"; // Known Monday

const context: PlanContext = {
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
    last7DayLoad: 800,
    last14DayLoad: 1500,
    completedSessions: [],
  },
  readinessToday: {
    date: WEEK_START_ISO,
    readiness: 4,
  },
};

// ── Display helpers ───────────────────────────────────────────────────────────

type PlanRow = {
  date: string;
  status: string;
  session: string;
  type: string;
  intensity: string;
  "duration (min)": number | string;
  targetRpe: number | string;
  load: number | string;
};

function toPlanRows(days: PlanDay[]): PlanRow[] {
  return days.map((day) => ({
    date: day.date,
    status: day.status,
    session: day.primary?.title ?? "— rest —",
    type: day.primary?.type ?? "—",
    intensity: day.primary?.intensity ?? "—",
    "duration (min)": day.primary?.durationMinutes ?? "—",
    targetRpe: day.primary?.targetRpe ?? "—",
    load: day.primary?.load ?? "—",
  }));
}

function sep(label: string): void {
  console.log(`\n── ${label} ${"─".repeat(Math.max(0, 44 - label.length))}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("\n================================================");
  console.log("  Training Engine — Local Smoke Test");
  console.log("================================================");

  // ── 1. Generate week plan ──────────────────────────────────────────────

  console.log(`\n📅  Week starting ${WEEK_START_ISO}  |  focus: triathlon\n`);
  const result = generateWeek(context, WEEK_START_ISO);

  console.log(
    `  Load target   : ${Math.round(result.weeklyLoadTarget)}\n` +
      `  Load planned  : ${Math.round(result.weeklyLoadPlanned)}\n` +
      `  Hard days     : ${result.hardDaysCount}\n` +
      `  Decision logs : ${result.decisionLog.length}`,
  );

  sep("Generated plan");
  console.table(toPlanRows(result.plan));

  if (result.decisionLog.length > 0) {
    sep("Generation decision log");
    for (const entry of result.decisionLog) {
      const icon = entry.severity === "warning" ? "⚠️ " : "ℹ️ ";
      console.log(`  ${icon} [${entry.rule}] ${entry.message}`);
    }
  }

  // ── 2. Simulate completing day 1 ──────────────────────────────────────

  sep("Simulate: complete day 1");
  const day1 = result.plan[0];
  const completedSessions: CompletedSession[] = [];

  if (day1 !== undefined && day1.primary !== undefined) {
    const { durationMinutes, type } = day1.primary;
    const rpe = 7;
    const load = computeLoad(durationMinutes, rpe);
    const session: CompletedSession = {
      id: `smoke-completed-${day1.date}`,
      date: day1.date,
      type,
      durationMinutes,
      rpe,
      load,
    };
    completedSessions.push(session);
    console.log(
      `\n  ✅ Completed on ${day1.date}: ${durationMinutes} min ${type} ` +
        `@ RPE ${rpe}  →  load ${load}`,
    );
  } else {
    console.log(`\n  ℹ️  Day 1 (${day1?.date ?? "unknown"}) is a rest day — skipping.`);
  }

  // ── 3. Simulate marking day 2 as missed ───────────────────────────────

  sep("Simulate: miss day 2");
  const day2 = result.plan[1];

  if (day2 === undefined) {
    throw new Error("Plan has fewer than 2 days — unexpected engine output.");
  }

  const missEvent: MissEvent = {
    dateISO: day2.date,
    kind: "missed",
    reason: "no_time",
  };

  console.log(`\n  ❌ Marking ${day2.date} as missed  (reason: no_time)`);

  const adjusted = adjustAfterMiss(context, result.plan, missEvent, {
    horizonDays: 2,
    allowRebalance: false,
  });

  if (adjusted.decisionLog.length > 0) {
    console.log();
    for (const entry of adjusted.decisionLog) {
      const icon = entry.severity === "warning" ? "⚠️ " : "ℹ️ ";
      console.log(`  ${icon} [${entry.rule}] ${entry.message}`);
    }
  }

  sep("Adjusted plan");
  console.table(toPlanRows(adjusted.plan));

  // ── 4. Adherence summary ──────────────────────────────────────────────

  sep("Adherence summary");
  const summary = summarizeAdherence(adjusted.plan, completedSessions);
  console.table([
    {
      plannedLoad: Math.round(summary.plannedLoad),
      completedLoad: Math.round(summary.completedLoad),
      "adherence%": `${summary.adherencePct.toFixed(1)}%`,
      sessionsPlanned: summary.sessionsPlanned,
      sessionsCompleted: summary.sessionsCompleted,
      sessionsMissed: summary.sessionsMissed,
    },
  ]);

  console.log("\n✅  Smoke test passed.\n");
}

main().catch((err: unknown) => {
  console.error("\n❌  Smoke test failed:", err);
  process.exit(1);
});
