import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserSettings, UserSettingsEquipment } from "@/lib/api/types";

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

// ── Public helper ─────────────────────────────────────────────────────────────

/**
 * Fetches user settings for the authenticated caller (RLS enforces user scope).
 * Returns hard-coded defaults if no row exists or on query error.
 */
export async function getUserSettingsOrDefault(
  supabase: SupabaseClient,
): Promise<UserSettings> {
  try {
    const { data, error } = await supabase
      .from("user_settings")
      .select("focus, weekly_minutes, equipment")
      .maybeSingle();

    if (error !== null || data === null) {
      return DEFAULT_SETTINGS;
    }

    return rowToSettings(data);
  } catch {
    return DEFAULT_SETTINGS;
  }
}
