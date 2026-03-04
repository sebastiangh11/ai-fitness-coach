"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import type { SaveSettingsPayload, UserSettingsEquipment } from "@/lib/api/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function currentWeekStartISO(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FOCUS_OPTIONS = [
  { value: "triathlon", label: "Triathlon" },
  { value: "hyrox", label: "Hyrox" },
  { value: "strength", label: "Strength" },
  { value: "half_marathon", label: "Half Marathon" },
  { value: "general_fitness", label: "General Fitness" },
] as const;

const FITNESS_LEVELS = ["Beginner", "Intermediate", "Advanced", "Elite"] as const;

const BACKEND_EQUIPMENT: { key: keyof UserSettingsEquipment; label: string }[] = [
  { key: "gym", label: "Gym" },
  { key: "trainer", label: "Bike Trainer" },
  { key: "pool", label: "Pool" },
  { key: "outdoorRun", label: "Outdoor Run" },
];

const EXTRA_EQUIPMENT_LABELS = ["Treadmill", "Dumbbells", "Barbell"] as const;

const HR_ZONES = [
  { name: "Zone 1", label: "Recovery", min: 0.5, max: 0.6, color: "bg-blue-500" },
  { name: "Zone 2", label: "Aerobic", min: 0.6, max: 0.7, color: "bg-green-500" },
  { name: "Zone 3", label: "Tempo", min: 0.7, max: 0.8, color: "bg-yellow-500" },
  { name: "Zone 4", label: "Threshold", min: 0.8, max: 0.9, color: "bg-orange-500" },
  { name: "Zone 5", label: "Max", min: 0.9, max: 1.0, color: "bg-red-500" },
];

const DEFAULT_FORM: SaveSettingsPayload = {
  focus: "triathlon",
  weeklyMinutes: 600,
  equipment: { gym: true, trainer: true, pool: true, outdoorRun: true },
};

// ── Primitive UI components ───────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      {children}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="mb-5 text-xs font-semibold uppercase tracking-widest text-zinc-400">
      {title}
    </h2>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-zinc-400">{label}</span>
      {children}
    </div>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none read-only:cursor-default read-only:opacity-50"
    />
  );
}

function StyledSelect({
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
    >
      {children}
    </select>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-zinc-200 text-zinc-900"
          : "border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300"
      }`}
    >
      {label}
    </button>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
        checked ? "bg-zinc-300" : "bg-zinc-700"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-zinc-900 shadow transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <Field label={`${label} — ${format(value)}`}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-zinc-300"
      />
      <div className="flex justify-between text-xs text-zinc-600">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </Field>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────

export default function SettingsForm({ isOnboarding }: { isOnboarding: boolean }) {
  const router = useRouter();

  // Backend-persisted fields
  const [form, setForm] = useState<SaveSettingsPayload>(DEFAULT_FORM);

  // Load / save state
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Section 1 — Profile (UI-only)
  const [displayName, setDisplayName] = useState("");
  const [fitnessLevel, setFitnessLevel] = useState("Intermediate");
  const [goal, setGoal] = useState("");
  const [nextCompetition, setNextCompetition] = useState("");
  const [competitionDate, setCompetitionDate] = useState("");

  // Section 2 — Extra equipment (UI-only)
  const [extraEquipment, setExtraEquipment] = useState<Record<string, boolean>>({
    Treadmill: false,
    Dumbbells: false,
    Barbell: false,
  });

  // Section 3 — Performance zones (UI-only)
  const [units, setUnits] = useState<"metric" | "imperial">("metric");
  const [maxHR, setMaxHR] = useState(190);
  const [ftp, setFtp] = useState(200);

  // Section 4 — Notifications (UI-only)
  const [notifications, setNotifications] = useState({
    trainingReminders: true,
    weeklySummary: true,
    restDayAlerts: false,
    goalProgress: true,
  });

  useEffect(() => {
    api
      .getSettings()
      .then((res) => {
        setForm({
          focus: res.settings.focus,
          weeklyMinutes: res.settings.weeklyMinutes,
          equipment: { ...res.settings.equipment },
        });
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : "Failed to load settings");
      })
      .finally(() => setLoading(false));
  }, []);

  function toggleEquipment(key: keyof UserSettingsEquipment) {
    setForm((f) => ({ ...f, equipment: { ...f.equipment, [key]: !f.equipment[key] } }));
    setSaved(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      await api.saveSettings(form);
      if (isOnboarding) {
        await api.initWeek(currentWeekStartISO());
        router.push("/today");
        return;
      }
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const hours = form.weeklyMinutes / 60;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      {isOnboarding && (
        <div className="mb-6 rounded-lg border border-blue-800 bg-blue-950/40 px-5 py-4">
          <p className="text-sm font-semibold text-blue-300">
            Welcome! Let&apos;s set up your training profile.
          </p>
          <p className="mt-1 text-sm text-blue-400">
            Configure your profile and equipment. We&apos;ll create your first training week automatically when you save.
          </p>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">Configure your training profile and preferences.</p>
      </div>

      {loading && <p className="text-sm text-zinc-500">Loading…</p>}
      {!loading && loadError !== null && <p className="text-sm text-red-500">{loadError}</p>}

      {!loading && loadError === null && (
        <form onSubmit={handleSave} className="flex flex-col gap-6">

          {/* ── Section 1: Profile ─────────────────────────────────────────── */}
          <Card>
            <SectionHeader title="Profile" />
            <div className="flex flex-col gap-5">

              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-xl font-bold text-zinc-300">
                  {displayName ? displayName[0].toUpperCase() : "?"}
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-300">Avatar</p>
                  <p className="mt-0.5 text-xs text-zinc-600">Photo upload coming soon</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Display Name">
                  <TextInput
                    type="text"
                    placeholder="Your name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </Field>
                <Field label="Email">
                  <TextInput type="email" placeholder="your@email.com" readOnly />
                </Field>
                <Field label="Primary Sport">
                  <StyledSelect
                    value={form.focus}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, focus: e.target.value }));
                      setSaved(false);
                    }}
                  >
                    {FOCUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </StyledSelect>
                </Field>
                <Field label="Fitness Level">
                  <StyledSelect
                    value={fitnessLevel}
                    onChange={(e) => setFitnessLevel(e.target.value)}
                  >
                    {FITNESS_LEVELS.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </StyledSelect>
                </Field>
              </div>

              <Slider
                label="Training Hours Per Week"
                value={hours}
                min={1}
                max={20}
                step={0.5}
                format={(v) => `${v.toFixed(1)}h`}
                onChange={(v) => {
                  setForm((f) => ({ ...f, weeklyMinutes: Math.round(v * 60) }));
                  setSaved(false);
                }}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Goal">
                  <TextInput
                    type="text"
                    placeholder="e.g. Complete first triathlon"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                  />
                </Field>
                <Field label="Next Competition">
                  <TextInput
                    type="text"
                    placeholder="e.g. Ironman 70.3"
                    value={nextCompetition}
                    onChange={(e) => setNextCompetition(e.target.value)}
                  />
                </Field>
                <Field label="Competition Date">
                  <TextInput
                    type="date"
                    value={competitionDate}
                    onChange={(e) => setCompetitionDate(e.target.value)}
                  />
                </Field>
              </div>
            </div>
          </Card>

          {/* ── Section 2: Training Setup ──────────────────────────────────── */}
          <Card>
            <SectionHeader title="Training Setup" />
            <div className="flex flex-col gap-5">
              <Field label="Weekly Time Budget (minutes)">
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={30}
                    max={1200}
                    step={30}
                    required
                    value={form.weeklyMinutes}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, weeklyMinutes: Number(e.target.value) }));
                      setSaved(false);
                    }}
                    className="w-28 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
                  />
                  <span className="text-sm text-zinc-500">
                    {Math.floor(form.weeklyMinutes / 60)}h
                    {form.weeklyMinutes % 60 > 0 ? ` ${form.weeklyMinutes % 60}m` : ""}
                  </span>
                </div>
              </Field>

              <div>
                <p className="mb-3 text-sm font-medium text-zinc-400">Equipment Access</p>
                <div className="flex flex-wrap gap-2">
                  {BACKEND_EQUIPMENT.map(({ key, label }) => (
                    <Chip
                      key={key}
                      label={label}
                      active={form.equipment[key]}
                      onClick={() => toggleEquipment(key)}
                    />
                  ))}
                  {EXTRA_EQUIPMENT_LABELS.map((label) => (
                    <Chip
                      key={label}
                      label={label}
                      active={extraEquipment[label] ?? false}
                      onClick={() => {
                        setExtraEquipment((e) => ({ ...e, [label]: !e[label] }));
                        setSaved(false);
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* ── Section 3: Performance Zones ───────────────────────────────── */}
          <Card>
            <SectionHeader title="Performance Zones" />
            <div className="flex flex-col gap-6">

              {/* Units toggle */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-zinc-400">Units</span>
                <div className="flex overflow-hidden rounded-lg border border-zinc-700">
                  {(["metric", "imperial"] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setUnits(u)}
                      className={`px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                        units === u
                          ? "bg-zinc-200 text-zinc-900"
                          : "text-zinc-400 hover:text-zinc-300"
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              <Slider
                label="Max Heart Rate"
                value={maxHR}
                min={130}
                max={220}
                step={1}
                format={(v) => `${v} bpm`}
                onChange={setMaxHR}
              />

              {/* Heart Rate Zones */}
              <div>
                <p className="mb-3 text-sm font-medium text-zinc-400">Heart Rate Zones</p>
                <div className="flex flex-col gap-2">
                  {HR_ZONES.map((z) => (
                    <div key={z.name} className="flex items-center gap-3">
                      <div className={`h-2 w-2 shrink-0 rounded-full ${z.color}`} />
                      <span className="w-14 text-xs font-medium text-zinc-400">{z.name}</span>
                      <span className="w-20 text-xs text-zinc-500">{z.label}</span>
                      <span className="font-mono text-xs text-zinc-300">
                        {Math.round(maxHR * z.min)}–{Math.round(maxHR * z.max)} bpm
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <Slider
                label="FTP (Functional Threshold Power)"
                value={ftp}
                min={100}
                max={500}
                step={5}
                format={(v) => `${v}W`}
                onChange={setFtp}
              />
            </div>
          </Card>

          {/* ── Section 4: Notifications ───────────────────────────────────── */}
          <Card>
            <SectionHeader title="Notifications" />
            <div className="flex flex-col gap-5">
              {(
                [
                  {
                    key: "trainingReminders",
                    label: "Training Reminders",
                    description: "Get notified before scheduled sessions",
                  },
                  {
                    key: "weeklySummary",
                    label: "Weekly Summary",
                    description: "Recap of your week every Sunday",
                  },
                  {
                    key: "restDayAlerts",
                    label: "Rest Day Alerts",
                    description: "Reminders to take it easy on rest days",
                  },
                  {
                    key: "goalProgress",
                    label: "Goal Progress",
                    description: "Updates toward your upcoming competition",
                  },
                ] as const
              ).map(({ key, label, description }) => (
                <div key={key} className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-zinc-300">{label}</p>
                    <p className="mt-0.5 text-xs text-zinc-600">{description}</p>
                  </div>
                  <Toggle
                    checked={notifications[key]}
                    onChange={() =>
                      setNotifications((n) => ({ ...n, [key]: !n[key] }))
                    }
                  />
                </div>
              ))}
            </div>
          </Card>

          {/* ── Save ──────────────────────────────────────────────────────── */}
          <div className="flex items-center gap-4 pb-4">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-zinc-50 px-6 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-200 disabled:opacity-50"
            >
              {saving
                ? isOnboarding
                  ? "Setting up…"
                  : "Saving…"
                : isOnboarding
                  ? "Save & Start Training"
                  : "Save Changes"}
            </button>
            {saved && (
              <p className="text-sm font-medium text-green-400">Changes saved</p>
            )}
            {saveError !== null && (
              <p className="text-sm text-red-500">{saveError}</p>
            )}
          </div>
        </form>
      )}
    </main>
  );
}
