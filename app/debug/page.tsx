"use client";

import { useState, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type AuthUser = { id: string; email: string };

type ApiResult = {
  method: string;
  url: string;
  status: number;
  body: unknown;
  durationMs: number;
  error?: string;
};

type LogEntry = {
  ts: string;
  label: string;
  method: string;
  url: string;
  status: number;
  durationMs: number;
  ok: boolean;
};

type Section = "auth" | "week" | "sessions" | "diag";

// ── Constants ─────────────────────────────────────────────────────────────────

const SESSION_TYPES = [
  "run", "bike", "swim", "strength", "hybrid", "mobility", "rest",
] as const;

const FOCUS_PRESETS: Record<string, object> = {
  general_fitness: {
    constraints: {
      focus: "general_fitness",
      timeBudget: { monday: 60, wednesday: 60, friday: 60 },
      equipment: { pool: false, gym: true, bikeTrainer: false, outdoorRun: true, rower: false },
    },
  },
  triathlon: {
    constraints: {
      focus: "triathlon",
      timeBudget: { monday: 60, tuesday: 45, wednesday: 90, thursday: 45, friday: 60, saturday: 120, sunday: 90 },
      equipment: { pool: true, gym: false, bikeTrainer: true, outdoorRun: true, rower: false },
    },
  },
  hyrox: {
    constraints: {
      focus: "hyrox",
      timeBudget: { monday: 60, wednesday: 60, thursday: 45, saturday: 90 },
      equipment: { pool: false, gym: true, bikeTrainer: false, outdoorRun: true, rower: true },
    },
  },
  half_marathon: {
    constraints: {
      focus: "half_marathon",
      timeBudget: { tuesday: 45, thursday: 60, saturday: 90, sunday: 60 },
      equipment: { pool: false, gym: false, bikeTrainer: false, outdoorRun: true, rower: false },
    },
  },
  strength: {
    constraints: {
      focus: "strength",
      timeBudget: { monday: 60, tuesday: 60, thursday: 60, friday: 60 },
      equipment: { pool: false, gym: true, bikeTrainer: false, outdoorRun: false, rower: false },
    },
  },
};

const DEFAULT_CTX = JSON.stringify(FOCUS_PRESETS.general_fitness, null, 2);

const TABS: { id: Section; label: string }[] = [
  { id: "auth",     label: "Auth" },
  { id: "week",     label: "Week Setup" },
  { id: "sessions", label: "Sessions" },
  { id: "diag",     label: "Diagnostics" },
];

// ── Pure helpers ──────────────────────────────────────────────────────────────

function currentMonday(): string {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}

function nextMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const daysAhead = ((8 - day) % 7) || 7;
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowHMS(): string {
  return new Date().toTimeString().slice(0, 8);
}

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

async function rawApiCall(
  label: string,
  url: string,
  method: string,
  body?: unknown,
): Promise<{ result: ApiResult; entry: LogEntry }> {
  const t0 = performance.now();
  try {
    const init: RequestInit = { method, credentials: "include" };
    if (body !== undefined) {
      init.headers = { "Content-Type": "application/json" };
      init.body = JSON.stringify(body);
    }
    const res = await fetch(url, init);
    const durationMs = Math.round(performance.now() - t0);
    let json: unknown;
    try { json = await res.json(); } catch { json = null; }
    const result: ApiResult = { method, url, status: res.status, body: json, durationMs };
    const entry: LogEntry = { ts: nowHMS(), label, method, url, status: res.status, durationMs, ok: res.ok };
    return { result, entry };
  } catch (err) {
    const durationMs = Math.round(performance.now() - t0);
    const error = err instanceof Error ? err.message : String(err);
    const result: ApiResult = { method, url, status: 0, body: null, durationMs, error };
    const entry: LogEntry = { ts: nowHMS(), label, method, url, status: 0, durationMs, ok: false };
    return { result, entry };
  }
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function statusBadgeClass(status: number): string {
  if (status === 0) return "bg-red-500/20 text-red-400 border border-red-500/30";
  if (status >= 200 && status < 300) return "bg-green-500/20 text-green-400 border border-green-500/30";
  if (status === 401 || status === 403) return "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30";
  return "bg-red-500/20 text-red-400 border border-red-500/30";
}

function logRowBorderClass(status: number): string {
  if (status === 0) return "border-l-2 border-l-red-500";
  if (status >= 200 && status < 300) return "border-l-2 border-l-green-500";
  if (status === 401 || status === 403) return "border-l-2 border-l-yellow-500";
  return "border-l-2 border-l-red-500";
}

// ── Shared component primitives ───────────────────────────────────────────────

const inputCls = (valid = true) =>
  `bg-zinc-950 border rounded-md px-3 py-2 text-sm w-full font-mono ${valid ? "border-zinc-700 focus:border-zinc-500" : "border-red-500"} outline-none`;

const labelCls = "block text-xs uppercase tracking-wide text-zinc-400 mb-1";

const btnPrimary = "px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-40 disabled:cursor-not-allowed";
const btnSecondary = "px-4 py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
const card = "bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DebugPage() {
  // ── Output ──────────────────────────────────────────────────────────────────
  const [lastResult, setLastResult] = useState<ApiResult | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [copied, setCopied] = useState(false);

  // ── Auth ─────────────────────────────────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [email, setEmail] = useState("test@example.com");
  const [password, setPassword] = useState("password123");

  // ── Nav ──────────────────────────────────────────────────────────────────────
  const [section, setSection] = useState<Section>("auth");

  // ── Week ─────────────────────────────────────────────────────────────────────
  const [weekStart, setWeekStart] = useState(currentMonday);

  // ── Simple init (uses persisted settings, no context override) ───────────────
  const [simpleWeekStart, setSimpleWeekStart] = useState(nextMonday);

  // ── Init Week context ─────────────────────────────────────────────────────────
  const [initCtx, setInitCtx] = useState(DEFAULT_CTX);
  const [ctxError, setCtxError] = useState<string | null>(null);
  const [ctxOk, setCtxOk] = useState(false);

  // ── Actions ───────────────────────────────────────────────────────────────────
  const [missedDate, setMissedDate] = useState(todayISO);
  const [sessionWeekStart, setSessionWeekStart] = useState(currentMonday);
  const [sessionDate, setSessionDate] = useState(todayISO);
  const [sessionKind, setSessionKind] = useState("run");
  const [sessionDuration, setSessionDuration] = useState("45");
  const [sessionRpe, setSessionRpe] = useState("6");

  // ── Derived guards ────────────────────────────────────────────────────────────
  const authed = currentUser !== null;
  const hasWeekStart = isValidDate(weekStart);
  const missedOk = isValidDate(missedDate);
  const sessionValid =
    isValidDate(sessionDate) &&
    isValidDate(sessionWeekStart) &&
    Number(sessionDuration) > 0 &&
    Number(sessionRpe) >= 1 &&
    Number(sessionRpe) <= 10;

  // ── Output helpers ────────────────────────────────────────────────────────────
  const push = useCallback((result: ApiResult, entry: LogEntry) => {
    setLastResult(result);
    setLog((prev) => [entry, ...prev]);
  }, []);

  const call = useCallback(
    async (label: string, url: string, method: string, body?: unknown): Promise<ApiResult> => {
      const { result, entry } = await rawApiCall(label, url, method, body);
      push(result, entry);
      return result;
    },
    [push],
  );

  // ── Auth actions ──────────────────────────────────────────────────────────────
  async function refreshMe() {
    const r = await call("Me", "/api/auth/me", "GET");
    if (r.status === 200) {
      const b = r.body as Record<string, unknown>;
      if (b.ok && b.user) {
        const u = b.user as { id: string; email: string };
        setCurrentUser({ id: u.id, email: u.email });
        return;
      }
    }
    setCurrentUser(null);
  }

  async function doLogin() {
    const r = await call("Login", "/api/auth/login", "POST", { email, password });
    if (r.status === 200) {
      const b = r.body as Record<string, unknown>;
      if (b.ok && b.user) {
        const u = b.user as { id: string; email: string };
        setCurrentUser({ id: u.id, email: u.email });
      }
    }
  }

  async function doSignup() {
    await call("Signup", "/api/auth/signup", "POST", { email, password });
  }

  async function doLogout() {
    await call("Logout", "/api/auth/logout", "POST");
    setCurrentUser(null);
  }

  // ── Week actions ──────────────────────────────────────────────────────────────
  async function doInitWeek() {
    let ctx: unknown;
    try { ctx = JSON.parse(initCtx); setCtxError(null); }
    catch (e) { setCtxError(e instanceof Error ? e.message : "Invalid JSON"); return; }
    await call("Init Week", "/api/plan/init-week", "POST", { weekStartISO: weekStart, context: ctx });
  }

  async function doGetWeek() {
    await call("Get Week", `/api/plan/week?weekStartISO=${encodeURIComponent(weekStart)}`, "GET");
  }

  async function doMarkMissed() {
    await call("Mark Missed", "/api/plan/mark-missed", "POST", { weekStartISO: weekStart, dateISO: missedDate });
  }

  async function doLogSession() {
    await call("Log Session", "/api/sessions/log", "POST", {
      weekStartISO: sessionWeekStart,
      session: { date: sessionDate, type: sessionKind, durationMinutes: Number(sessionDuration), rpe: Number(sessionRpe) },
    });
  }

  async function doSimpleInitWeek() {
    const r = await call("Init Week (settings)", "/api/plan/init-week", "POST", { weekStartISO: simpleWeekStart });
    const b = r.body as Record<string, unknown> | null;
    if (r.status === 200 && b?.ok === true && typeof b.weekStartISO === "string") {
      setSimpleWeekStart(b.weekStartISO);
    }
  }

  async function doSimpleGetWeek() {
    await call("Get Week (settings)", `/api/plan/week?weekStartISO=${encodeURIComponent(simpleWeekStart)}`, "GET");
  }

  async function doAdherence() {
    await call("Adherence", `/api/adherence?weekStartISO=${encodeURIComponent(weekStart)}`, "GET");
  }

  async function doDebugCookies() {
    await call("Debug Cookies", "/api/auth/debug-cookies", "GET");
  }

  // ── Quick actions ─────────────────────────────────────────────────────────────
  async function runHappyPath() {
    await refreshMe();
    let ctx: unknown;
    try { ctx = JSON.parse(initCtx); }
    catch (e) { setCtxError(e instanceof Error ? e.message : "Invalid JSON"); return; }
    await call("Init Week", "/api/plan/init-week", "POST", { weekStartISO: weekStart, context: ctx });
    await call("Get Week", `/api/plan/week?weekStartISO=${encodeURIComponent(weekStart)}`, "GET");
  }

  async function runLogoutVerify() {
    await call("Logout", "/api/auth/logout", "POST");
    setCurrentUser(null);
    await call("Me (expect 401)", "/api/auth/me", "GET");
  }

  // ── Context helpers ───────────────────────────────────────────────────────────
  function validateCtx() {
    try { JSON.parse(initCtx); setCtxError(null); setCtxOk(true); }
    catch (e) { setCtxError(e instanceof Error ? e.message : "Invalid JSON"); setCtxOk(false); }
  }

  function applyPreset(focus: string) {
    const preset = FOCUS_PRESETS[focus];
    if (preset) { setInitCtx(JSON.stringify(preset, null, 2)); setCtxError(null); setCtxOk(false); }
  }

  function resetCtx() {
    setInitCtx(DEFAULT_CTX);
    setCtxError(null);
    setCtxOk(false);
  }

  function copyJSON() {
    if (!lastResult) return;
    void navigator.clipboard.writeText(JSON.stringify(lastResult.body, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      <div className="max-w-5xl mx-auto py-10 px-6 space-y-8">

        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight">Debug Console</h1>
          <span className="text-xs font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-500 uppercase tracking-wider">
            DEV ONLY
          </span>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-zinc-500">
              week:{" "}
              <code className={hasWeekStart ? "text-zinc-300" : "text-red-400"}>
                {weekStart || "—"}
              </code>
            </span>
            <button className={btnSecondary} onClick={() => void refreshMe()}>
              Refresh
            </button>
          </div>
        </div>

        {/* ── AUTH STATUS BANNER ───────────────────────────────────────────── */}
        <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-sm ${
          authed
            ? "bg-green-500/10 border-green-500/30 text-green-400"
            : "bg-red-500/10 border-red-500/30 text-red-400"
        }`}>
          <span className="font-semibold">{authed ? "Logged In" : "Logged Out"}</span>
          {currentUser && (
            <>
              <span className="text-zinc-300">{currentUser.email}</span>
              <span className="text-zinc-600">({currentUser.id.slice(0, 8)}…)</span>
            </>
          )}
        </div>

        {/* ── QUICK ACTIONS ────────────────────────────────────────────────── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 flex flex-wrap items-center gap-3">
          <span className="text-xs uppercase tracking-wide text-zinc-500 font-semibold">Quick</span>
          <button
            className={btnPrimary}
            disabled={!authed || !hasWeekStart}
            onClick={() => void runHappyPath()}
          >
            Happy Path (Me → Init → Get)
          </button>
          <button className={btnSecondary} onClick={() => void runLogoutVerify()}>
            Logout Verify (Logout → Me → 401)
          </button>
          {!authed && (
            <span className="text-red-400 text-xs">login required for Happy Path</span>
          )}
        </div>

        {/* ── TABS ─────────────────────────────────────────────────────────── */}
        <div className="border-b border-zinc-800 flex">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setSection(t.id)}
              className={`px-4 py-2 text-sm border-b-2 transition-colors ${
                section === t.id
                  ? "border-blue-500 text-white bg-zinc-900"
                  : "border-transparent text-zinc-400 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── 1. AUTH ──────────────────────────────────────────────────────── */}
        {section === "auth" && (
          <div className={card}>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              POST /api/auth/signup · POST /api/auth/login · POST /api/auth/logout · GET /api/auth/me
            </p>
            <div className="grid gap-3 max-w-sm">
              <div>
                <label className={labelCls}>Email</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email"
                  className={inputCls()}
                />
              </div>
              <div>
                <label className={labelCls}>Password</label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="password"
                  type="password"
                  className={inputCls()}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className={btnSecondary} onClick={() => void doSignup()}>Signup</button>
              <button className={btnPrimary} onClick={() => void doLogin()}>Login</button>
              <button className={btnSecondary} disabled={!authed} onClick={() => void doLogout()}>Logout</button>
              <button className={btnSecondary} onClick={() => void refreshMe()}>Me</button>
            </div>
          </div>
        )}

        {/* ── 2. WEEK SETUP ────────────────────────────────────────────────── */}
        {section === "week" && (
          <div className="space-y-6">

            {/* Shared weekStart + full context init */}
            <div className={card}>
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500 mb-3">
                  Shared weekStartISO — Init Week · Get Week · Mark Missed · Adherence
                </p>
                <div className="max-w-xs">
                  <label className={labelCls}>Week Start ISO</label>
                  <input
                    value={weekStart}
                    onChange={(e) => setWeekStart(e.target.value)}
                    placeholder="YYYY-MM-DD"
                    className={inputCls(hasWeekStart)}
                  />
                  {!hasWeekStart && <p className="text-red-400 text-xs mt-1">Invalid date</p>}
                </div>
              </div>

              <div className="border-t border-zinc-800 pt-4 space-y-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  POST /api/plan/init-week — with context override
                </p>
                <div className="flex flex-wrap gap-2 items-center">
                  <label className="text-xs text-zinc-400">Preset:</label>
                  <select
                    className="bg-zinc-950 border border-zinc-700 rounded-md px-3 py-2 text-sm outline-none"
                    defaultValue=""
                    onChange={(e) => applyPreset(e.target.value)}
                  >
                    <option value="" disabled>select…</option>
                    {Object.keys(FOCUS_PRESETS).map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                  <button className={btnSecondary} onClick={resetCtx}>Reset</button>
                  <button className={btnSecondary} onClick={validateCtx}>Validate JSON</button>
                  {ctxError && <span className="text-red-400 text-xs">✗ {ctxError}</span>}
                  {ctxOk && !ctxError && <span className="text-green-400 text-xs">✓ valid</span>}
                </div>
                <textarea
                  value={initCtx}
                  onChange={(e) => { setInitCtx(e.target.value); setCtxError(null); setCtxOk(false); }}
                  rows={14}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-md p-3 text-sm leading-relaxed font-mono resize-y outline-none focus:border-zinc-500 min-h-[220px]"
                />
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    className={btnPrimary}
                    disabled={!authed || !hasWeekStart}
                    onClick={() => void doInitWeek()}
                  >
                    Init Week
                  </button>
                  {!authed && <span className="text-red-400 text-xs">Login first</span>}
                  {authed && !hasWeekStart && <span className="text-red-400 text-xs">Set valid weekStartISO</span>}
                </div>
              </div>
            </div>

            {/* Init from settings */}
            <div className={card}>
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                POST /api/plan/init-week — uses persisted user_settings (no context body)
              </p>
              <div className="max-w-xs">
                <label className={labelCls}>Week Start ISO</label>
                <input
                  value={simpleWeekStart}
                  onChange={(e) => setSimpleWeekStart(e.target.value)}
                  placeholder="YYYY-MM-DD"
                  className={inputCls(isValidDate(simpleWeekStart))}
                />
                {!isValidDate(simpleWeekStart) && <p className="text-red-400 text-xs mt-1">Invalid date</p>}
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                <button
                  className={btnPrimary}
                  disabled={!authed || !isValidDate(simpleWeekStart)}
                  onClick={() => void doSimpleInitWeek()}
                >
                  Init Week
                </button>
                <button
                  className={btnSecondary}
                  disabled={!authed || !isValidDate(simpleWeekStart)}
                  onClick={() => void doSimpleGetWeek()}
                >
                  Fetch Week
                </button>
                {!authed && <span className="text-red-400 text-xs">Login first</span>}
              </div>
            </div>
          </div>
        )}

        {/* ── 3. SESSIONS ──────────────────────────────────────────────────── */}
        {section === "sessions" && (
          <div className="space-y-6">

            {/* Get Week + Adherence */}
            <div className={card}>
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                GET /api/plan/week · GET /api/adherence — uses shared weekStartISO
              </p>
              <div className="flex gap-2 flex-wrap items-center">
                <button
                  className={btnSecondary}
                  disabled={!authed || !hasWeekStart}
                  onClick={() => void doGetWeek()}
                >
                  Get Week Snapshot
                </button>
                <button
                  className={btnSecondary}
                  disabled={!authed || !hasWeekStart}
                  onClick={() => void doAdherence()}
                >
                  Fetch Adherence
                </button>
                {!authed && <span className="text-red-400 text-xs">Login first</span>}
                {authed && !hasWeekStart && (
                  <span className="text-red-400 text-xs">Set weekStartISO in Week Setup</span>
                )}
              </div>
            </div>

            {/* Mark Missed */}
            <div className={card}>
              <p className="text-xs uppercase tracking-wide text-zinc-500">POST /api/plan/mark-missed</p>
              <div className="max-w-xs">
                <label className={labelCls}>Date</label>
                <input
                  value={missedDate}
                  onChange={(e) => setMissedDate(e.target.value)}
                  placeholder="YYYY-MM-DD"
                  className={inputCls(missedOk)}
                />
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                <button
                  className={btnSecondary}
                  disabled={!authed || !hasWeekStart || !missedOk}
                  onClick={() => void doMarkMissed()}
                >
                  Mark Missed
                </button>
                {!authed && <span className="text-red-400 text-xs">Login first</span>}
                {authed && !hasWeekStart && <span className="text-red-400 text-xs">weekStartISO invalid</span>}
              </div>
            </div>

            {/* Log Session */}
            <div className={card}>
              <p className="text-xs uppercase tracking-wide text-zinc-500">POST /api/sessions/log</p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <label className={labelCls}>Week Start</label>
                  <input
                    value={sessionWeekStart}
                    onChange={(e) => setSessionWeekStart(e.target.value)}
                    placeholder="YYYY-MM-DD"
                    className={inputCls(isValidDate(sessionWeekStart))}
                  />
                </div>
                <div>
                  <label className={labelCls}>Date</label>
                  <input
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                    placeholder="YYYY-MM-DD"
                    className={inputCls(isValidDate(sessionDate))}
                  />
                </div>
                <div>
                  <label className={labelCls}>Type</label>
                  <select
                    value={sessionKind}
                    onChange={(e) => setSessionKind(e.target.value)}
                    className="bg-zinc-950 border border-zinc-700 rounded-md px-3 py-2 text-sm w-full outline-none"
                  >
                    {SESSION_TYPES.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Duration (min)</label>
                  <input
                    value={sessionDuration}
                    onChange={(e) => setSessionDuration(e.target.value)}
                    className={inputCls()}
                  />
                </div>
                <div>
                  <label className={labelCls}>RPE (1–10)</label>
                  <input
                    value={sessionRpe}
                    onChange={(e) => setSessionRpe(e.target.value)}
                    className={inputCls()}
                  />
                </div>
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                <button
                  className={btnPrimary}
                  disabled={!authed || !sessionValid}
                  onClick={() => void doLogSession()}
                >
                  Log Session
                </button>
                {!authed && <span className="text-red-400 text-xs">Login first</span>}
                {authed && !sessionValid && (
                  <span className="text-red-400 text-xs">
                    Check fields (valid dates, duration {">"} 0, RPE 1–10)
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── 4. DIAGNOSTICS ───────────────────────────────────────────────── */}
        {section === "diag" && (
          <div className={card}>
            <p className="text-xs uppercase tracking-wide text-zinc-500">GET /api/auth/debug-cookies</p>
            <div>
              <button className={btnSecondary} onClick={() => void doDebugCookies()}>
                Debug Cookies
              </button>
            </div>
          </div>
        )}

        {/* ── OUTPUT PANEL ─────────────────────────────────────────────────── */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">

          {/* Request log */}
          <div className="max-h-40 overflow-y-auto border-b border-zinc-800">
            {log.length === 0 ? (
              <div className="px-4 py-3 text-zinc-600 text-xs">No requests yet.</div>
            ) : (
              log.map((e, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-4 py-1.5 text-xs border-b border-zinc-800/50 ${logRowBorderClass(e.status)} ${
                    e.ok ? "bg-green-500/5" : "bg-red-500/5"
                  }`}
                >
                  <span className="text-zinc-600 shrink-0">{e.ts}</span>
                  <span className="font-semibold text-zinc-200 shrink-0 w-44 truncate">{e.label}</span>
                  <span className="text-zinc-500 shrink-0">{e.method}</span>
                  <span className="text-zinc-400 flex-1 truncate">{e.url}</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs font-bold shrink-0 ${statusBadgeClass(e.status)}`}>
                    {e.status || "ERR"}
                  </span>
                  <span className="text-zinc-600 shrink-0">{e.durationMs}ms</span>
                </div>
              ))
            )}
          </div>

          {/* Last response */}
          {lastResult ? (
            <div>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 flex-wrap">
                <code className="text-zinc-300 text-xs">{lastResult.method} {lastResult.url}</code>
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${statusBadgeClass(lastResult.status)}`}>
                  {lastResult.status || "ERR"}
                </span>
                <span className="text-zinc-500 text-xs">{lastResult.durationMs}ms</span>
                {lastResult.error && <span className="text-red-400 text-xs">{lastResult.error}</span>}
                <div className="ml-auto flex gap-2">
                  <button
                    className="px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-xs transition-colors"
                    onClick={copyJSON}
                  >
                    {copied ? "Copied!" : "Copy JSON"}
                  </button>
                  <button
                    className="px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-xs transition-colors"
                    onClick={() => { setLastResult(null); setLog([]); }}
                  >
                    Clear
                  </button>
                </div>
              </div>
              <pre className="mt-3 bg-black/60 border border-zinc-800 rounded-md p-4 text-xs overflow-auto mx-4 mb-4">
                {JSON.stringify(lastResult.body, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="px-4 py-3 text-zinc-600 text-xs">Response will appear here.</div>
          )}
        </div>

      </div>
    </div>
  );
}
