import { NextResponse } from "next/server";
import { requireAuth } from "../../../lib/server/requireAuth";
import type { UserSettings, UserSettingsEquipment } from "../../../lib/api/types";

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: UserSettings = {
  focus: "triathlon",
  weeklyMinutes: 600,
  equipment: { gym: true, trainer: true, pool: true, outdoorRun: true },
};

// ── DB row → domain ───────────────────────────────────────────────────────────

function rowToSettings(row: {
  focus: string;
  weekly_minutes: number;
  equipment: unknown;
}): UserSettings {
  const eq = row.equipment as Partial<UserSettingsEquipment>;
  return {
    focus: row.focus,
    weeklyMinutes: row.weekly_minutes,
    equipment: {
      gym: eq.gym ?? false,
      trainer: eq.trainer ?? false,
      pool: eq.pool ?? false,
      outdoorRun: eq.outdoorRun ?? false,
    },
  };
}

// ── GET /api/settings ─────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { data, error } = await auth.supabase
      .from("user_settings")
      .select("focus, weekly_minutes, equipment")
      .eq("user_id", auth.userId)
      .maybeSingle();

    if (error !== null) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const settings = data !== null ? rowToSettings(data) : DEFAULT_SETTINGS;
    return NextResponse.json({ ok: true, settings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// ── POST /api/settings ────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  // Basic validation
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ ok: false, error: "Body must be an object" }, { status: 400 });
  }

  const { focus, weeklyMinutes, equipment } = body as Record<string, unknown>;

  if (typeof focus !== "string" || focus.trim() === "") {
    return NextResponse.json({ ok: false, error: "focus must be a non-empty string" }, { status: 400 });
  }

  if (typeof weeklyMinutes !== "number" || weeklyMinutes < 0) {
    return NextResponse.json({ ok: false, error: "weeklyMinutes must be a non-negative number" }, { status: 400 });
  }

  if (typeof equipment !== "object" || equipment === null) {
    return NextResponse.json({ ok: false, error: "equipment must be an object" }, { status: 400 });
  }

  const eq = equipment as Record<string, unknown>;
  const validEquipment: UserSettingsEquipment = {
    gym: Boolean(eq.gym),
    trainer: Boolean(eq.trainer),
    pool: Boolean(eq.pool),
    outdoorRun: Boolean(eq.outdoorRun),
  };

  try {
    const { data, error } = await auth.supabase
      .from("user_settings")
      .upsert(
        {
          user_id: auth.userId,
          focus: focus.trim(),
          weekly_minutes: Math.round(weeklyMinutes),
          equipment: validEquipment,
        },
        { onConflict: "user_id" },
      )
      .select("focus, weekly_minutes, equipment")
      .single();

    if (error !== null) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, settings: rowToSettings(data) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
