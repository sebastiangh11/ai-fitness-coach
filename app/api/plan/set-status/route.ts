import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "../../../../lib/server/requireAuth";

const bodySchema = z.object({
  weekStartISO: z.string().min(1),
  dateISO: z.string().min(1),
  status: z.enum(["planned", "completed", "missed"]),
});

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

  const { weekStartISO, dateISO, status } = parsed.data;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    // Resolve week_id (RLS scopes to current user).
    const { data: weekRow, error: weekErr } = await auth.supabase
      .from("weeks")
      .select("id")
      .eq("week_start", weekStartISO)
      .maybeSingle();

    if (weekErr !== null) {
      return NextResponse.json({ ok: false, error: weekErr.message }, { status: 500 });
    }
    if (weekRow === null || weekRow === undefined) {
      return NextResponse.json({ ok: false, error: "Week not found" }, { status: 404 });
    }

    const weekId = weekRow.id as string;

    // Fetch current payload so we can patch status inside the JSON blob.
    const { data: dayRow, error: dayErr } = await auth.supabase
      .from("plan_days")
      .select("payload")
      .eq("week_id", weekId)
      .eq("date", dateISO)
      .maybeSingle();

    if (dayErr !== null) {
      return NextResponse.json({ ok: false, error: dayErr.message }, { status: 500 });
    }
    if (dayRow === null || dayRow === undefined) {
      return NextResponse.json(
        { ok: false, error: "Plan day not found" },
        { status: 404 },
      );
    }

    const updatedPayload = {
      ...(dayRow.payload as Record<string, unknown>),
      status,
    };

    const { error: updateErr } = await auth.supabase
      .from("plan_days")
      .update({ status, payload: updatedPayload })
      .eq("week_id", weekId)
      .eq("date", dateISO);

    if (updateErr !== null) {
      return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
    }

    // If overriding back to a non-completed state, remove any logged sessions
    // so the UI doesn't keep treating the day as done.
    if (status !== "completed") {
      await auth.supabase
        .from("completed_sessions")
        .delete()
        .eq("week_id", weekId)
        .eq("date", dateISO);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
