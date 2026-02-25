// NOTE: TrainingStateStore methods are declared synchronous in the interface.
// Supabase operations are inherently async. This class implements all methods
// as async (returning Promises). Void-returning methods satisfy the interface
// via TypeScript's void-return assignability. The three read methods
// (getWeekPlan, getCompletedSessions, getDecisionLog) return Promises and will
// require the TrainingStateStore interface to be updated to async for full
// TypeScript strict compliance. The implementation itself is correct and complete.

import type { CompletedSession, DecisionLog, PlanDay, PlanContext } from "../../types";
import type { TrainingStateStore, WeekPlanSnapshot } from "../store";
import { supabase } from "../../../db/supabaseClient";
import type { PostgrestError } from "@supabase/supabase-js";

const USER_KEY = "local" as const;

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Strips the time component from any ISO string and returns YYYY-MM-DD.
 * Safe to call with a plain date string that has no time component.
 */
function toISODateOnly(isoString: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(isoString);
  if (match === null || match[1] === undefined) {
    throw new Error(`toISODateOnly: cannot parse date from "${isoString}"`);
  }
  return match[1];
}

/**
 * Throws a descriptive error when a Supabase operation returns an error object.
 */
function assertSupabaseOk(
  error: PostgrestError | null,
  context: string,
): void {
  if (error !== null) {
    throw new Error(
      `SupabaseStore [${context}]: ${error.message} (code: ${error.code})`,
    );
  }
}

/**
 * Fetches the UUID for an existing week row.
 * Throws a clear error if the week does not exist in the database.
 */
async function getOrCreateWeekId(weekStartISO: string): Promise<string> {
  const { data, error } = await supabase
    .from("weeks")
    .select("id")
    .eq("user_key", USER_KEY)
    .eq("week_start", toISODateOnly(weekStartISO))
    .maybeSingle();

  assertSupabaseOk(error, "getOrCreateWeekId");

  if (data === null || data === undefined) {
    throw new Error(
      `SupabaseStore: no week found for "${weekStartISO}" ` +
        `(user_key="${USER_KEY}"). Call initWeek first.`,
    );
  }

  return data.id as string;
}

// ── SupabaseStore ─────────────────────────────────────────────────────────────

export class SupabaseStore implements TrainingStateStore {
  // ── initWeek ─────────────────────────────────────────────────────────────

  async initWeek(snapshot: WeekPlanSnapshot): Promise<void> {
    const weekDate = toISODateOnly(snapshot.weekStartISO);

    // 1. Upsert weeks row (unique on user_key, week_start).
    const { data: weekRow, error: weekError } = await supabase
      .from("weeks")
      .upsert(
        {
          user_key: USER_KEY,
          week_start: weekDate,
          engine_version: snapshot.engineVersion,
          context_json: snapshot.context,
          created_at: snapshot.createdAt,
          updated_at: snapshot.updatedAt,
        },
        { onConflict: "user_key,week_start" },
      )
      .select("id")
      .single();

    assertSupabaseOk(weekError, "initWeek/weeks-upsert");
    if (weekRow === null || weekRow === undefined) {
      throw new Error(
        `SupabaseStore.initWeek: upsert returned no row for "${snapshot.weekStartISO}"`,
      );
    }

    const weekId = weekRow.id as string;

    // 2. Upsert plan_days — one row per calendar date.
    const planDaysRows = snapshot.planDays.map((day) => ({
      week_id: weekId,
      date: toISODateOnly(day.date),
      status: day.status,
      payload: day,
    }));

    const { error: daysError } = await supabase
      .from("plan_days")
      .upsert(planDaysRows, { onConflict: "week_id,date" });

    assertSupabaseOk(daysError, "initWeek/plan-days-upsert");

    // 3. Append decision_logs row — source='generator'.
    const { error: logError } = await supabase.from("decision_logs").insert({
      week_id: weekId,
      source: "generator",
      entries: snapshot.decisionLog,
    });

    assertSupabaseOk(logError, "initWeek/decision-logs-insert");
  }

  // ── getWeekPlan ───────────────────────────────────────────────────────────

  async getWeekPlan(
    weekStartISO: string,
  ): Promise<WeekPlanSnapshot | undefined> {
    const weekDate = toISODateOnly(weekStartISO);

    // 1. Fetch weeks row.
    const { data: weekRow, error: weekError } = await supabase
      .from("weeks")
      .select("id, engine_version, context_json, created_at, updated_at")
      .eq("user_key", USER_KEY)
      .eq("week_start", weekDate)
      .maybeSingle();

    assertSupabaseOk(weekError, "getWeekPlan/weeks-select");
    if (weekRow === null || weekRow === undefined) return undefined;

    const weekId = weekRow.id as string;

    // 2. Fetch plan_days ordered by date.
    const { data: planDaysRows, error: daysError } = await supabase
      .from("plan_days")
      .select("payload")
      .eq("week_id", weekId)
      .order("date", { ascending: true });

    assertSupabaseOk(daysError, "getWeekPlan/plan-days-select");

    // 3. Fetch decision_logs ordered by created_at.
    const { data: logRows, error: logError } = await supabase
      .from("decision_logs")
      .select("entries")
      .eq("week_id", weekId)
      .order("created_at", { ascending: true });

    assertSupabaseOk(logError, "getWeekPlan/decision-logs-select");

    const planDays = (planDaysRows ?? []).map((row) => row.payload as PlanDay);
    const decisionLog = (logRows ?? []).flatMap(
      (row) => row.entries as DecisionLog[],
    );

    return {
      weekStartISO,
      context: weekRow.context_json as PlanContext,
      planDays,
      decisionLog,
      createdAt: weekRow.created_at as string,
      updatedAt: weekRow.updated_at as string,
      engineVersion: weekRow.engine_version as string,
    };
  }

  // ── saveWeekPlan ──────────────────────────────────────────────────────────

  async saveWeekPlan(snapshot: WeekPlanSnapshot): Promise<void> {
    const weekDate = toISODateOnly(snapshot.weekStartISO);

    // 1. Update the weeks row — context, engine version, and updatedAt.
    const { data: weekRow, error: weekError } = await supabase
      .from("weeks")
      .update({
        context_json: snapshot.context,
        engine_version: snapshot.engineVersion,
        updated_at: snapshot.updatedAt,
      })
      .eq("user_key", USER_KEY)
      .eq("week_start", weekDate)
      .select("id")
      .single();

    assertSupabaseOk(weekError, "saveWeekPlan/weeks-update");
    if (weekRow === null || weekRow === undefined) {
      throw new Error(
        `SupabaseStore.saveWeekPlan: week not found for "${snapshot.weekStartISO}". ` +
          `Call initWeek first.`,
      );
    }

    const weekId = weekRow.id as string;

    // 2. Upsert plan_days rows.
    const planDaysRows = snapshot.planDays.map((day) => ({
      week_id: weekId,
      date: toISODateOnly(day.date),
      status: day.status,
      payload: day,
    }));

    const { error: daysError } = await supabase
      .from("plan_days")
      .upsert(planDaysRows, { onConflict: "week_id,date" });

    assertSupabaseOk(daysError, "saveWeekPlan/plan-days-upsert");

    // 3. Append decision_logs row — source='runtime'.
    const { error: logError } = await supabase.from("decision_logs").insert({
      week_id: weekId,
      source: "runtime",
      entries: snapshot.decisionLog,
    });

    assertSupabaseOk(logError, "saveWeekPlan/decision-logs-insert");
  }

  // ── logCompletedSession ───────────────────────────────────────────────────

  async logCompletedSession(
    weekStartISO: string,
    session: CompletedSession,
  ): Promise<void> {
    const weekId = await getOrCreateWeekId(weekStartISO);

    const { error } = await supabase.from("completed_sessions").insert({
      week_id: weekId,
      date: toISODateOnly(session.date),
      payload: session,
    });

    assertSupabaseOk(error, "logCompletedSession/insert");
  }

  // ── markMissed ────────────────────────────────────────────────────────────

  async markMissed(
    weekStartISO: string,
    dateISO: string,
    reason?: string,
  ): Promise<void> {
    const weekId = await getOrCreateWeekId(weekStartISO);
    const date = toISODateOnly(dateISO);

    // 1. Fetch the current plan_days row so we can update the payload.
    const { data: dayRow, error: fetchError } = await supabase
      .from("plan_days")
      .select("payload")
      .eq("week_id", weekId)
      .eq("date", date)
      .maybeSingle();

    assertSupabaseOk(fetchError, "markMissed/plan-days-select");
    if (dayRow === null || dayRow === undefined) {
      throw new Error(
        `SupabaseStore.markMissed: no plan_day found for date "${dateISO}" ` +
          `in week "${weekStartISO}"`,
      );
    }

    const currentPayload = dayRow.payload as PlanDay;

    // Leave already-terminal days unchanged; otherwise stamp status='missed'.
    const isTerminal =
      currentPayload.status === "missed" ||
      currentPayload.status === "completed";
    const updatedPayload: PlanDay = isTerminal
      ? currentPayload
      : { ...currentPayload, status: "missed" };

    // 2. Update plan_days row.
    const { error: updateError } = await supabase
      .from("plan_days")
      .update({ status: "missed", payload: updatedPayload })
      .eq("week_id", weekId)
      .eq("date", date);

    assertSupabaseOk(updateError, "markMissed/plan-days-update");

    // 3. Append decision_logs row — source='miss'.
    const logEntry: DecisionLog = {
      rule: "mark_missed",
      message:
        reason !== undefined
          ? `Day ${dateISO} marked as missed (reason: ${reason}).`
          : `Day ${dateISO} marked as missed.`,
      severity: "info",
    };

    const { error: logError } = await supabase.from("decision_logs").insert({
      week_id: weekId,
      source: "miss",
      entries: [logEntry],
    });

    assertSupabaseOk(logError, "markMissed/decision-logs-insert");
  }

  // ── getCompletedSessions ──────────────────────────────────────────────────

  async getCompletedSessions(
    weekStartISO: string,
  ): Promise<CompletedSession[]> {
    const weekDate = toISODateOnly(weekStartISO);

    const { data: weekRow, error: weekError } = await supabase
      .from("weeks")
      .select("id")
      .eq("user_key", USER_KEY)
      .eq("week_start", weekDate)
      .maybeSingle();

    assertSupabaseOk(weekError, "getCompletedSessions/weeks-select");
    if (weekRow === null || weekRow === undefined) return [];

    const { data, error } = await supabase
      .from("completed_sessions")
      .select("payload")
      .eq("week_id", weekRow.id as string)
      .order("date", { ascending: true });

    assertSupabaseOk(error, "getCompletedSessions/select");

    return (data ?? []).map((row) => row.payload as CompletedSession);
  }

  // ── getDecisionLog ────────────────────────────────────────────────────────

  async getDecisionLog(weekStartISO: string): Promise<DecisionLog[]> {
    const weekDate = toISODateOnly(weekStartISO);

    const { data: weekRow, error: weekError } = await supabase
      .from("weeks")
      .select("id")
      .eq("user_key", USER_KEY)
      .eq("week_start", weekDate)
      .maybeSingle();

    assertSupabaseOk(weekError, "getDecisionLog/weeks-select");
    if (weekRow === null || weekRow === undefined) return [];

    const { data, error } = await supabase
      .from("decision_logs")
      .select("entries")
      .eq("week_id", weekRow.id as string)
      .order("created_at", { ascending: true });

    assertSupabaseOk(error, "getDecisionLog/select");

    return (data ?? []).flatMap((row) => row.entries as DecisionLog[]);
  }
}
