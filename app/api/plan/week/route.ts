import { NextResponse } from "next/server";
import { getRuntime } from "../../../../lib/server/trainingRuntime";
import { requireAuth } from "../../../../lib/server/requireAuth";
import { toWeekStartISO } from "../../../../lib/training-engine/utils/weekStart";

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const param = searchParams.get("weekStartISO");

  try {
    let resolvedWeek: string;

    if (param !== null && param.trim() !== "") {
      // Explicit week requested — normalize to Monday of that week.
      try {
        resolvedWeek = toWeekStartISO(param.trim());
      } catch {
        return NextResponse.json(
          { ok: false, error: "weekStartISO is not a valid date" },
          { status: 400 },
        );
      }
    } else {
      // No param — resolve the latest week for this user (RLS scopes to auth.uid()).
      const { data, error } = await auth.supabase
        .from("weeks")
        .select("week_start")
        .order("week_start", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error !== null) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
      if (data === null || data === undefined) {
        return NextResponse.json(
          { ok: false, error: "No weeks found" },
          { status: 404 },
        );
      }
      resolvedWeek = data.week_start as string;
    }

    const runtime = getRuntime(auth.supabase);
    const snapshot = await runtime.getWeekPlan(resolvedWeek);
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
