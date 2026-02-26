import { NextResponse } from "next/server";
import { getRuntime } from "../../../../lib/server/trainingRuntime";
import { requireAuth } from "../../../../lib/server/requireAuth";

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const weekStartISO = searchParams.get("weekStartISO");

  if (weekStartISO === null || weekStartISO.trim() === "") {
    return NextResponse.json(
      { ok: false, error: "Missing required query param: weekStartISO" },
      { status: 400 },
    );
  }

  try {
    const runtime = getRuntime(auth.supabase);
    const snapshot = await runtime.getWeekPlan(weekStartISO);
    if (snapshot === undefined) {
      return NextResponse.json(
        { ok: false, error: "Week not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, snapshot });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
