import { NextResponse } from "next/server";
import { getRuntime } from "../../../lib/server/trainingRuntime";

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const weekStartISO = searchParams.get("weekStartISO");

  if (weekStartISO === null || weekStartISO.trim() === "") {
    return NextResponse.json(
      { ok: false, error: "Missing required query param: weekStartISO" },
      { status: 400 },
    );
  }

  try {
    const runtime = getRuntime();
    const summary = await runtime.getAdherenceSummary(weekStartISO);
    if (summary === undefined) {
      return NextResponse.json(
        { ok: false, error: "Week not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
