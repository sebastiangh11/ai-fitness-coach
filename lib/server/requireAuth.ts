import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "./supabaseServer";

type AuthOk = {
  userId: string;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
};

/**
 * Verifies the Supabase session from cookies.
 *
 * Returns an AuthOk object on success, or a 401 NextResponse on failure.
 * Use `instanceof NextResponse` to discriminate in route handlers:
 *
 *   const auth = await requireAuth();
 *   if (auth instanceof NextResponse) return auth;
 *   const runtime = getRuntime(auth.supabase);
 */
export async function requireAuth(): Promise<NextResponse | AuthOk> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error !== null || data.user === null) {
    return NextResponse.json({ ok: false, error: "Auth session missing" }, { status: 401 });
  }

  return { userId: data.user.id, supabase };
}
