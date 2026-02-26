import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const incoming = req.cookies.getAll().map((c) => c.name);
  return NextResponse.json({ ok: true, incoming });
}
