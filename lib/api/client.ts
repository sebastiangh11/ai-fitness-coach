/**
 * Thin typed frontend API client.
 *
 * - All requests include credentials: "include".
 * - Non-2xx responses throw ApiError with status + message + raw body.
 * - No server-only imports — safe to use from client components.
 */

import type {
  MeResponse,
  LoginResponse,
  SignupResponse,
  LogoutResponse,
  InitWeekResponse,
  GetWeekResponse,
  MarkMissedResponse,
  LogSessionPayload,
  LogSessionResponse,
  GetAdherenceResponse,
  SetStatusResponse,
  DevStatus,
  PlanContext,
  GetSettingsResponse,
  SaveSettingsPayload,
  SaveSettingsResponse,
} from "./types";

// ── Error ─────────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractErrorMessage(body: unknown, status: number): string {
  if (typeof body === "object" && body !== null && "error" in body) {
    const { error } = body as { error: unknown };
    if (typeof error === "string") return error;
  }
  return `HTTP ${status}`;
}

async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...init, credentials: "include" });

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    throw new ApiError(res.status, body, extractErrorMessage(body, res.status));
  }

  return body as T;
}

function get<T>(url: string): Promise<T> {
  return apiFetch<T>(url);
}

function post<T>(url: string, data?: unknown): Promise<T> {
  return apiFetch<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: data !== undefined ? JSON.stringify(data) : undefined,
  });
}

// ── Client ────────────────────────────────────────────────────────────────────

export const api = {
  // Auth
  me: () =>
    get<MeResponse>("/api/auth/me"),

  login: (email: string, password: string) =>
    post<LoginResponse>("/api/auth/login", { email, password }),

  signup: (email: string, password: string) =>
    post<SignupResponse>("/api/auth/signup", { email, password }),

  logout: () =>
    post<LogoutResponse>("/api/auth/logout"),

  // Plan
  initWeek: (weekStartISO: string, context?: PlanContext) =>
    post<InitWeekResponse>(
      "/api/plan/init-week",
      context !== undefined ? { weekStartISO, context } : { weekStartISO },
    ),

  getWeek: (weekStartISO?: string) =>
    get<GetWeekResponse>(
      weekStartISO !== undefined
        ? `/api/plan/week?weekStartISO=${encodeURIComponent(weekStartISO)}`
        : "/api/plan/week",
    ),

  markMissed: (weekStartISO: string, dateISO: string, reason?: string) =>
    post<MarkMissedResponse>("/api/plan/mark-missed", {
      weekStartISO,
      dateISO,
      ...(reason !== undefined ? { reason } : {}),
    }),

  // Sessions
  logSession: (payload: LogSessionPayload) =>
    post<LogSessionResponse>("/api/sessions/log", payload),

  // Adherence
  getAdherence: (weekStartISO: string) =>
    get<GetAdherenceResponse>(
      `/api/adherence?weekStartISO=${encodeURIComponent(weekStartISO)}`,
    ),

  // Dev tools (blocked in production by the route handler)
  setStatus: (weekStartISO: string, dateISO: string, status: DevStatus) =>
    post<SetStatusResponse>("/api/plan/set-status", { weekStartISO, dateISO, status }),

  // Settings
  getSettings: () =>
    get<GetSettingsResponse>("/api/settings"),

  saveSettings: (payload: SaveSettingsPayload) =>
    post<SaveSettingsResponse>("/api/settings", payload),
};
