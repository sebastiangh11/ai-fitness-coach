import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/server/supabaseServer";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user) {
      return NextResponse.json({ ok: false, error: "Auth session missing" }, { status: 401 });
    }

    const user = { id: data.user.id, email: data.user.email ?? null };
    return NextResponse.json({ ok: true, user }, { status: 200 });
  } catch {
    return NextResponse.json({ ok: false, error: "Auth session missing" }, { status: 401 });
  }
}
