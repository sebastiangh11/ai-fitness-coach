import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/server/supabaseServer";

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().trim().min(6),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "validation", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const user = data?.user ?? null;
    if (!user) {
      return NextResponse.json({ ok: false, error: "No user returned" }, { status: 500 });
    }

    const res = NextResponse.json(
      { ok: true, user: { id: user.id, email: user.email ?? null } },
      { status: 200 }
    );
    res.headers.set("x-auth-cookie-set", "1");
    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
