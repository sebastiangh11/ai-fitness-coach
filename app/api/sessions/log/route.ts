import { NextResponse } from "next/server";
import { z } from "zod";
import { getRuntime } from "../../../../lib/server/trainingRuntime";
import { requireAuth } from "../../../../lib/server/requireAuth";
import { computeLoad } from "../../../../lib/training-engine/load";

const bodySchema = z.object({
  weekStartISO: z.string().min(1),
  session: z.object({
    id: z.string().optional(),
    date: z.string(),
    type: z.enum([
      "run",
      "bike",
      "swim",
      "strength",
      "hybrid",
      "mobility",
      "rest",
    ]),
    durationMinutes: z.number().optional(),
    rpe: z.number().optional(),
    load: z.number().optional(),
    notes: z.string().optional(),
  }),
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

  const { weekStartISO, session: raw } = parsed.data;

  // Resolve load: use provided value, or compute from durationMinutes + rpe.
  let load: number;
  if (raw.load !== undefined) {
    load = raw.load;
  } else if (raw.durationMinutes !== undefined && raw.rpe !== undefined) {
    load = computeLoad(raw.durationMinutes, raw.rpe);
  } else {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Cannot compute load: provide either 'load' or both 'durationMinutes' and 'rpe'.",
      },
      { status: 400 },
    );
  }

  // Both durationMinutes and rpe are required for a valid CompletedSession record.
  if (raw.durationMinutes === undefined || raw.rpe === undefined) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing required fields: 'durationMinutes' and 'rpe'.",
      },
      { status: 400 },
    );
  }

  const session = {
    id: raw.id ?? crypto.randomUUID(),
    date: raw.date,
    type: raw.type,
    durationMinutes: raw.durationMinutes,
    rpe: raw.rpe,
    load,
    ...(raw.notes !== undefined ? { notes: raw.notes } : {}),
  };

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const runtime = getRuntime(auth.supabase);
    await runtime.logCompletedSession(weekStartISO, session);

    // Update the corresponding plan_day status to "completed".
    // This is route-level persistence — no engine/store changes required.
    const { data: weekRow } = await auth.supabase
      .from("weeks")
      .select("id")
      .eq("week_start", weekStartISO)
      .maybeSingle();

    if (weekRow !== null && weekRow !== undefined) {
      const { data: dayRow } = await auth.supabase
        .from("plan_days")
        .select("payload")
        .eq("week_id", weekRow.id as string)
        .eq("date", session.date)
        .maybeSingle();

      if (dayRow !== null && dayRow !== undefined) {
        const updatedPayload = {
          ...(dayRow.payload as Record<string, unknown>),
          status: "completed",
        };
        await auth.supabase
          .from("plan_days")
          .update({ status: "completed", payload: updatedPayload })
          .eq("week_id", weekRow.id as string)
          .eq("date", session.date);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
