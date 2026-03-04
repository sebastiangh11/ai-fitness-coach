import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Forwards the current pathname as an `x-pathname` request header so that
 * server-side layout components can read it via `headers()` from next/headers.
 */
export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Run on all routes except Next.js internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
