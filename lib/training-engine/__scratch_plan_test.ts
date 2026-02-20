import { generateWeek } from "./generators/planGenerator";
import type { PlanContext } from "./types";

const context: PlanContext = {
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
      pool: false,
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
    readiness: 5,
  },
};

const result = generateWeek(context, "2026-02-16");

console.log("Plan:");
console.dir(result.plan, { depth: null });

console.log("Hard Days:", result.hardDaysCount);
console.log("Weekly Planned Load:", result.weeklyLoadPlanned);
console.log("Weekly Target Load:", result.weeklyLoadTarget);
console.log("Decision Log:");
console.dir(result.decisionLog, { depth: null });
