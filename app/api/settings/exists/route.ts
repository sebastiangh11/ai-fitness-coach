import { NextResponse } from "next/server";
import { requireAuth } from "../../../../lib/server/requireAuth";

export async function GET(): Promise<NextResponse> {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await auth.supabase
    .from("user_settings")
    .select("user_id")
    .limit(1)
    .maybeSingle();

  if (error !== null) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, exists: data !== null });
}
