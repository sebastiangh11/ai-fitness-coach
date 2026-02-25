import { NextResponse } from "next/server";
import { z } from "zod";
import { getRuntime } from "../../../../lib/server/trainingRuntime";

const bodySchema = z.object({
  weekStartISO: z.string().min(1),
  session: z.object({
    id: z.string(),
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
    durationMinutes: z.number(),
    rpe: z.number(),
    load: z.number(),
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

  const { weekStartISO, session } = parsed.data;

  try {
    const runtime = getRuntime();
    await runtime.logCompletedSession(weekStartISO, session);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
