import type { CompletedSession, DecisionLog, PlanDay, PlanContext } from "../../types";
import type { TrainingStateStore, WeekPlanSnapshot } from "../store";
import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";

// ── Internal helpers ──────────────────────────────────────────────────────────

function toISODateOnly(isoString: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(isoString);
  if (match === null || match[1] === undefined) {
    throw new Error(`toISODateOnly: cannot parse date from "${isoString}"`);
  }
  return match[1];
}

function assertSupabaseOk(error: PostgrestError | null, context: string): void {
  if (error !== null) {
    throw new Error(`SupabaseStore [${context}]: ${error.message} (code: ${error.code})`);
  }
}

// ── SupabaseStore ─────────────────────────────────────────────────────────────

/**
 * Supabase-backed TrainingStateStore.
 *
 * Requires an authenticated SupabaseClient (from createSupabaseServerClient).
 * RLS on the DB enforces per-user isolation; this class does NOT filter by
 * user_id explicitly — policies apply transparently via auth.uid().
 */
export class SupabaseStore implements TrainingStateStore {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  // ── private helpers ───────────────────────────────────────────────────────

  private async getWeekId(weekStartISO: string): Promise<string> {
    const { data, error } = await this.client
      .from("weeks")
      .select("id")
      .eq("week_start", toISODateOnly(weekStartISO))
      .maybeSingle();

    assertSupabaseOk(error, "getWeekId");

    if (data === null || data === undefined) {
      throw new Error(
        `SupabaseStore: no week found for "${weekStartISO}". Call initWeek first.`,
      );
    }

    return data.id as string;
  }

  // ── initWeek ─────────────────────────────────────────────────────────────

  async initWeek(snapshot: WeekPlanSnapshot): Promise<void> {
    const weekDate = toISODateOnly(snapshot.weekStartISO);

    // user_id is set by DEFAULT auth.uid() on first insert;
    // conflict target matches the (user_id, week_start) unique constraint added in 002_auth_rls.sql.
    const { data: weekRow, error: weekError } = await this.client
      .from("weeks")
      .upsert(
        {
          week_start: weekDate,
          engine_version: snapshot.engineVersion,
          context_json: snapshot.context,
          created_at: snapshot.createdAt,
          updated_at: snapshot.updatedAt,
        },
        { onConflict: "user_id,week_start" },
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

    const planDaysRows = snapshot.planDays.map((day) => ({
      week_id: weekId,
      date: toISODateOnly(day.date),
      status: day.status,
      payload: day,
    }));

    const { error: daysError } = await this.client
      .from("plan_days")
      .upsert(planDaysRows, { onConflict: "week_id,date" });

    assertSupabaseOk(daysError, "initWeek/plan-days-upsert");

    const { error: logError } = await this.client.from("decision_logs").insert({
      week_id: weekId,
      source: "generator",
      entries: snapshot.decisionLog,
    });

    assertSupabaseOk(logError, "initWeek/decision-logs-insert");
  }

  // ── getWeekPlan ───────────────────────────────────────────────────────────

  async getWeekPlan(weekStartISO: string): Promise<WeekPlanSnapshot | undefined> {
    const weekDate = toISODateOnly(weekStartISO);

    const { data: weekRow, error: weekError } = await this.client
      .from("weeks")
      .select("id, engine_version, context_json, created_at, updated_at")
      .eq("week_start", weekDate)
      .maybeSingle();

    assertSupabaseOk(weekError, "getWeekPlan/weeks-select");
    if (weekRow === null || weekRow === undefined) return undefined;

    const weekId = weekRow.id as string;

    const { data: planDaysRows, error: daysError } = await this.client
      .from("plan_days")
      .select("payload")
      .eq("week_id", weekId)
      .order("date", { ascending: true });

    assertSupabaseOk(daysError, "getWeekPlan/plan-days-select");

    const { data: logRows, error: logError } = await this.client
      .from("decision_logs")
      .select("entries")
      .eq("week_id", weekId)
      .order("created_at", { ascending: true });

    assertSupabaseOk(logError, "getWeekPlan/decision-logs-select");

    const planDays = (planDaysRows ?? []).map((row) => row.payload as PlanDay);
    const decisionLog = (logRows ?? []).flatMap((row) => row.entries as DecisionLog[]);

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

    // RLS scopes the UPDATE to the current user's rows automatically.
    const { data: weekRow, error: weekError } = await this.client
      .from("weeks")
      .update({
        context_json: snapshot.context,
        engine_version: snapshot.engineVersion,
        updated_at: snapshot.updatedAt,
      })
      .eq("week_start", weekDate)
      .select("id")
      .single();

    assertSupabaseOk(weekError, "saveWeekPlan/weeks-update");
    if (weekRow === null || weekRow === undefined) {
      throw new Error(
        `SupabaseStore.saveWeekPlan: week not found for "${snapshot.weekStartISO}". Call initWeek first.`,
      );
    }

    const weekId = weekRow.id as string;

    const planDaysRows = snapshot.planDays.map((day) => ({
      week_id: weekId,
      date: toISODateOnly(day.date),
      status: day.status,
      payload: day,
    }));

    const { error: daysError } = await this.client
      .from("plan_days")
      .upsert(planDaysRows, { onConflict: "week_id,date" });

    assertSupabaseOk(daysError, "saveWeekPlan/plan-days-upsert");

    const { error: logError } = await this.client.from("decision_logs").insert({
      week_id: weekId,
      source: "runtime",
      entries: snapshot.decisionLog,
    });

    assertSupabaseOk(logError, "saveWeekPlan/decision-logs-insert");
  }

  // ── logCompletedSession ───────────────────────────────────────────────────

  async logCompletedSession(weekStartISO: string, session: CompletedSession): Promise<void> {
    const weekId = await this.getWeekId(weekStartISO);

    const { error } = await this.client.from("completed_sessions").insert({
      week_id: weekId,
      date: toISODateOnly(session.date),
      payload: session,
    });

    assertSupabaseOk(error, "logCompletedSession/insert");
  }

  // ── markMissed ────────────────────────────────────────────────────────────

  async markMissed(weekStartISO: string, dateISO: string, reason?: string): Promise<void> {
    const weekId = await this.getWeekId(weekStartISO);
    const date = toISODateOnly(dateISO);

    const { data: dayRow, error: fetchError } = await this.client
      .from("plan_days")
      .select("payload")
      .eq("week_id", weekId)
      .eq("date", date)
      .maybeSingle();

    assertSupabaseOk(fetchError, "markMissed/plan-days-select");
    if (dayRow === null || dayRow === undefined) {
      throw new Error(
        `SupabaseStore.markMissed: no plan_day found for date "${dateISO}" in week "${weekStartISO}"`,
      );
    }

    const currentPayload = dayRow.payload as PlanDay;
    const isTerminal = currentPayload.status === "missed" || currentPayload.status === "completed";
    const updatedPayload: PlanDay = isTerminal
      ? currentPayload
      : { ...currentPayload, status: "missed" };

    const { error: updateError } = await this.client
      .from("plan_days")
      .update({ status: "missed", payload: updatedPayload })
      .eq("week_id", weekId)
      .eq("date", date);

    assertSupabaseOk(updateError, "markMissed/plan-days-update");

    const logEntry: DecisionLog = {
      rule: "mark_missed",
      message:
        reason !== undefined
          ? `Day ${dateISO} marked as missed (reason: ${reason}).`
          : `Day ${dateISO} marked as missed.`,
      severity: "info",
    };

    const { error: logError } = await this.client.from("decision_logs").insert({
      week_id: weekId,
      source: "miss",
      entries: [logEntry],
    });

    assertSupabaseOk(logError, "markMissed/decision-logs-insert");
  }

  // ── getCompletedSessions ──────────────────────────────────────────────────

  async getCompletedSessions(weekStartISO: string): Promise<CompletedSession[]> {
    const weekDate = toISODateOnly(weekStartISO);

    const { data: weekRow, error: weekError } = await this.client
      .from("weeks")
      .select("id")
      .eq("week_start", weekDate)
      .maybeSingle();

    assertSupabaseOk(weekError, "getCompletedSessions/weeks-select");
    if (weekRow === null || weekRow === undefined) return [];

    const { data, error } = await this.client
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

    const { data: weekRow, error: weekError } = await this.client
      .from("weeks")
      .select("id")
      .eq("week_start", weekDate)
      .maybeSingle();

    assertSupabaseOk(weekError, "getDecisionLog/weeks-select");
    if (weekRow === null || weekRow === undefined) return [];

    const { data, error } = await this.client
      .from("decision_logs")
      .select("entries")
      .eq("week_id", weekRow.id as string)
      .order("created_at", { ascending: true });

    assertSupabaseOk(error, "getDecisionLog/select");

    return (data ?? []).flatMap((row) => row.entries as DecisionLog[]);
  }
}
