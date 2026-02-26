import { NextResponse } from "next/server";
import { z } from "zod";
import { getRuntime } from "../../../../lib/server/trainingRuntime";
import { requireAuth } from "../../../../lib/server/requireAuth";

// Accept `dateISO` (canonical) or `date` (alias used by other routes) — pick whichever is present.
const bodySchema = z
  .object({
    weekStartISO: z.string().min(1),
    dateISO: z.string().min(1).optional(),
    date: z.string().min(1).optional(),
    reason: z.string().optional(),
  })
  .refine((v) => v.dateISO !== undefined || v.date !== undefined, {
    message: "dateISO (or date) is required",
    path: ["dateISO"],
  })
  .transform((v) => ({
    weekStartISO: v.weekStartISO,
    dateISO: (v.dateISO ?? v.date) as string,
    reason: v.reason,
  }));

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

  const { weekStartISO, dateISO, reason } = parsed.data;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const runtime = getRuntime(auth.supabase);
    const snapshot = await runtime.markMissed(weekStartISO, dateISO, reason);
    return NextResponse.json({
      ok: true,
      updatedPlanDays: snapshot.planDays,
      decisionLog: snapshot.decisionLog,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
