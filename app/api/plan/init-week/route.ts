import { NextResponse } from "next/server";
import { z } from "zod";
import { getRuntime } from "../../../../lib/server/trainingRuntime";
import { requireAuth } from "../../../../lib/server/requireAuth";
import { getUserSettingsOrDefault } from "../../../../lib/db/userSettings";
import { toWeekStartISO } from "../../../../lib/training-engine/utils/weekStart";
import type { PlanContext, FocusType, AthleteConstraints } from "../../../../lib/training-engine/types";
import type { UserSettings } from "../../../../lib/api/types";

// ── Leaf schemas ──────────────────────────────────────────────────────────────

const sessionTypeSchema = z.enum([
  "run",
  "bike",
  "swim",
  "strength",
  "hybrid",
  "mobility",
  "rest",
]);

const intensitySchema = z.enum(["easy", "moderate", "hard"]);

const prioritySchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

const readinessValueSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

// ── Compound schemas ──────────────────────────────────────────────────────────

const timeBudgetSchema = z.object({
  monday: z.number().optional(),
  tuesday: z.number().optional(),
  wednesday: z.number().optional(),
  thursday: z.number().optional(),
  friday: z.number().optional(),
  saturday: z.number().optional(),
  sunday: z.number().optional(),
});

const equipmentSchema = z.object({
  pool: z.boolean(),
  gym: z.boolean(),
  bikeTrainer: z.boolean(),
  outdoorRun: z.boolean(),
  rower: z.boolean().optional(),
});

const constraintsSchema = z.object({
  focus: z.enum([
    "triathlon",
    "hyrox",
    "strength",
    "half_marathon",
    "general_fitness",
  ]),
  timeBudget: timeBudgetSchema,
  equipment: equipmentSchema,
});

const completedSessionSchema = z.object({
  id: z.string(),
  date: z.string(),
  type: sessionTypeSchema,
  durationMinutes: z.number(),
  rpe: z.number(),
  load: z.number(),
  notes: z.string().optional(),
});

const historySchema = z.object({
  last7DayLoad: z.number(),
  last14DayLoad: z.number(),
  completedSessions: z.array(completedSessionSchema),
});

const baseSessionSchema = z.object({
  id: z.string(),
  date: z.string(),
  type: sessionTypeSchema,
  title: z.string(),
  description: z.string().optional(),
  durationMinutes: z.number(),
  targetRpe: z.number(),
  intensity: intensitySchema,
  priority: prioritySchema,
  load: z.number(),
});

const planDaySchema = z.object({
  date: z.string(),
  primary: baseSessionSchema.optional(),
  secondary: baseSessionSchema.optional(),
  status: z.enum(["planned", "completed", "missed", "modified"]),
});

const dailyReadinessSchema = z.object({
  date: z.string(),
  readiness: readinessValueSchema,
  soreness: readinessValueSchema.optional(),
  injuryFlag: z.boolean().optional(),
  injuryNotes: z.string().optional(),
});

// context is fully optional — missing fields are filled from user settings
const contextSchema = z.object({
  constraints: constraintsSchema.optional(),
  history: historySchema.optional(),
  readinessToday: dailyReadinessSchema.optional(),
  existingPlan: z.array(planDaySchema).optional(),
});

const bodySchema = z.object({
  weekStartISO: z.string().min(1),
  context: contextSchema.optional(),
});

// ── Settings → constraints mapping ───────────────────────────────────────────

const VALID_FOCUS = new Set<FocusType>([
  "triathlon",
  "hyrox",
  "strength",
  "half_marathon",
  "general_fitness",
]);

function settingsToConstraints(settings: UserSettings): AthleteConstraints {
  const focus: FocusType = VALID_FOCUS.has(settings.focus as FocusType)
    ? (settings.focus as FocusType)
    : "general_fitness";

  // Distribute weekly budget evenly across all 7 days.
  const daily = Math.round(settings.weeklyMinutes / 7);

  return {
    focus,
    timeBudget: {
      monday: daily,
      tuesday: daily,
      wednesday: daily,
      thursday: daily,
      friday: daily,
      saturday: daily,
      sunday: daily,
    },
    equipment: {
      gym: settings.equipment.gym,
      bikeTrainer: settings.equipment.trainer,
      pool: settings.equipment.pool,
      outdoorRun: settings.equipment.outdoorRun,
    },
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid request body", details: parsed.error.issues },
      { status: 400 },
    );
  }

  let weekStartISO: string;
  try {
    weekStartISO = toWeekStartISO(parsed.data.weekStartISO);
  } catch {
    return NextResponse.json(
      { ok: false, error: "weekStartISO is not a valid date" },
      { status: 400 },
    );
  }
  const bodyCtx = parsed.data.context;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  // Fetch persisted settings; body constraints override if provided.
  const settings = await getUserSettingsOrDefault(auth.supabase);
  const defaultConstraints = settingsToConstraints(settings);

  const context: PlanContext = {
    constraints: bodyCtx?.constraints ?? defaultConstraints,
    history: bodyCtx?.history ?? {
      last7DayLoad: 0,
      last14DayLoad: 0,
      completedSessions: [],
    },
    readinessToday: bodyCtx?.readinessToday ?? {
      date: new Date().toISOString().slice(0, 10),
      readiness: 4 as const,
    },
    existingPlan: bodyCtx?.existingPlan,
  };

  try {
    const runtime = getRuntime(auth.supabase);
    const snapshot = await runtime.initWeek(context, weekStartISO);
    return NextResponse.json({
      ok: true,
      weekStartISO: snapshot.weekStartISO,
      planDays: snapshot.planDays,
      decisionLog: snapshot.decisionLog,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
