/**
 * Frontend API types.
 *
 * Only `import type` is used so this file is safe for client components —
 * no server-only code is transitively bundled.
 */

import type {
  PlanContext,
  PlanDay,
  DecisionLog,
  SessionType,
} from "@/lib/training-engine/types";
import type { WeekPlanSnapshot } from "@/lib/training-engine/runtime/store";
import type { AdherenceSummary } from "@/lib/training-engine/evaluators/adherence";

// Re-export so callers can import everything from one place.
export type {
  PlanContext,
  PlanDay,
  DecisionLog,
  SessionType,
  WeekPlanSnapshot,
  AdherenceSummary,
};

// ── Shared ────────────────────────────────────────────────────────────────────

export interface ApiUser {
  id: string;
  email: string | null;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface MeResponse {
  ok: true;
  user: ApiUser;
}

export interface LoginResponse {
  ok: true;
  user: ApiUser;
}

export interface SignupResponse {
  ok: true;
}

export interface LogoutResponse {
  ok: true;
}

// ── Plan ──────────────────────────────────────────────────────────────────────

export interface InitWeekResponse {
  ok: true;
  weekStartISO: string;
  planDays: PlanDay[];
  decisionLog: DecisionLog[];
}

export interface GetWeekResponse {
  ok: true;
  snapshot: WeekPlanSnapshot;
}

export interface MarkMissedResponse {
  ok: true;
  updatedPlanDays: PlanDay[];
  decisionLog: DecisionLog[];
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export interface LogSessionPayload {
  weekStartISO: string;
  session: {
    id?: string;
    date: string;
    type: SessionType;
    durationMinutes: number;
    rpe: number;
    load?: number;
    notes?: string;
  };
}

export interface LogSessionResponse {
  ok: true;
}

// ── Dev tools ─────────────────────────────────────────────────────────────────

export type DevStatus = "planned" | "completed" | "missed";

export interface SetStatusResponse {
  ok: true;
}

// ── Adherence ─────────────────────────────────────────────────────────────────

export interface GetAdherenceResponse {
  ok: true;
  summary: AdherenceSummary;
}

// ── Settings ──────────────────────────────────────────────────────────────────

export interface UserSettingsEquipment {
  gym: boolean;
  trainer: boolean;
  pool: boolean;
  outdoorRun: boolean;
}

export interface UserSettings {
  focus: string;
  weeklyMinutes: number;
  equipment: UserSettingsEquipment;
}

export interface GetSettingsResponse {
  ok: true;
  settings: UserSettings;
}

export interface SaveSettingsPayload {
  focus: string;
  weeklyMinutes: number;
  equipment: UserSettingsEquipment;
}

export interface SaveSettingsResponse {
  ok: true;
  settings: UserSettings;
}
