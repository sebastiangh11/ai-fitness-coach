import type { PlanContext, PlanDay, CompletedSession, DecisionLog } from "../types";
import { generateWeek } from "../generators/planGenerator";
import { adjustAfterMiss, type MissEvent, type MissReason } from "../adjusters/missAdjuster";
import { computeLoad } from "../load";
import { summarizeAdherence } from "../evaluators/adherence";
import { isISODateOnly } from "../utils/dates";

// ==============================
// State Shape
// ==============================

export interface EngineState {
  weekStartISO: string | null;
  plan: PlanDay[];
  completed: CompletedSession[];
  context: PlanContext | null;
}

const state: EngineState = {
  weekStartISO: null,
  plan: [],
  completed: [],
  context: null,
};

// ==============================
// Guards
// ==============================

function requireISO(iso: string, label: string): void {
  if (!isISODateOnly(iso)) {
    throw new Error(`${label}: "${iso}" is not a valid ISO date-only string (YYYY-MM-DD).`);
  }
}

function requireInitialized(): PlanContext {
  if (state.context === null) {
    throw new Error(
      "Training engine not initialized. Call initWeek(context, weekStartISO) first."
    );
  }
  return state.context;
}

function clonePlan(plan: PlanDay[]): PlanDay[] {
  return plan.map((day) => ({
    ...day,
    primary: day.primary ? { ...day.primary } : undefined,
    secondary: day.secondary ? { ...day.secondary } : undefined,
  }));
}

// ==============================
// Public API
// ==============================

export function initWeek(context: PlanContext, weekStartISO: string): EngineState {
  requireISO(weekStartISO, "initWeek");
  const result = generateWeek(context, weekStartISO);
  state.weekStartISO = weekStartISO;
  state.plan = result.plan;
  state.completed = [];
  state.context = context;
  return getState();
}

export function getState(): EngineState {
  return {
    weekStartISO: state.weekStartISO,
    plan: clonePlan(state.plan),
    completed: [...state.completed],
    context: state.context,
  };
}

export function getWeekPlan(): PlanDay[] {
  return clonePlan(state.plan);
}

export function logCompletedSession(input: {
  dateISO: string;
  type: CompletedSession["type"];
  durationMinutes: number;
  rpe: number;
  notes?: string;
}): CompletedSession {
  requireInitialized();
  requireISO(input.dateISO, "logCompletedSession");

  const load = computeLoad(input.durationMinutes, input.rpe);
  const session: CompletedSession = {
    id: `${input.dateISO}-${input.type}-${input.durationMinutes}-${input.rpe}`,
    date: input.dateISO,
    type: input.type,
    durationMinutes: input.durationMinutes,
    rpe: input.rpe,
    load,
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
  };

  state.completed.push(session);

  // Mark matching plan day as completed (status only; leave session content intact)
  const dayIdx = state.plan.findIndex((d) => d.date === input.dateISO);
  if (dayIdx !== -1 && state.plan[dayIdx].status === "planned") {
    state.plan[dayIdx] = { ...state.plan[dayIdx], status: "completed" };
  }

  return session;
}

export function markMissed(
  dateISO: string,
  reason?: MissReason,
  notes?: string
): { plan: PlanDay[]; decisionLog: DecisionLog[] } {
  const context = requireInitialized();
  requireISO(dateISO, "markMissed");

  const event: MissEvent = {
    dateISO,
    kind: "missed",
    ...(reason !== undefined ? { reason } : {}),
    ...(notes !== undefined ? { notes } : {}),
  };

  const result = adjustAfterMiss(context, state.plan, event, {
    horizonDays: 2,
    allowRebalance: false,
  });

  state.plan = result.plan;

  return { plan: clonePlan(state.plan), decisionLog: result.decisionLog };
}

export function getAdherenceSummary() {
  requireInitialized();
  return summarizeAdherence(state.plan, state.completed);
}
