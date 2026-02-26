import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/db/env";
import { NextRequest, NextResponse } from "next/server";

type SupabaseRouteClient = {
  supabase: ReturnType<typeof createServerClient>;
  response: NextResponse;
};

export function createSupabaseRouteClient(req: NextRequest): SupabaseRouteClient {
  const response = NextResponse.next();

  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const host = req.headers.get("host") ?? "";
  const isLocalhost = host.includes("localhost") || host.includes("127.0.0.1");
  const secure = process.env.NODE_ENV === "production" && proto === "https" && !isLocalhost;

  const cookieHandlers = {
    getAll: () => req.cookies.getAll().map((c) => ({ name: c.name, value: c.value })),
    setAll: (cookiesArray: Array<{ name: string; value: string; path?: string; expires?: string | Date; httpOnly?: boolean; sameSite?: string }>) => {
      for (const c of cookiesArray) {
        const opts: { path?: string; expires?: Date; httpOnly?: boolean; sameSite?: "lax" | "strict" | "none"; secure?: boolean } = {};
        opts.path = c.path ?? "/";
        if (c.expires) opts.expires = typeof c.expires === "string" ? new Date(c.expires) : c.expires;
        opts.httpOnly = c.httpOnly ?? true;
        opts.sameSite = ("lax" as const);
        opts.secure = secure;

        response.cookies.set({ name: c.name, value: c.value, ...opts });
      }
    },
  } as const;

  const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: cookieHandlers,
    cookieOptions: { secure, sameSite: "lax", path: "/" },
  });

  return { supabase, response };
}
