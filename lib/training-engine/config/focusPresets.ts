import type {
  FocusType,
  SessionType,
  IntensityLevel,
  SessionPriority,
} from "../types";

// ==============================
// Preset Shape Definitions
// ==============================

export type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export interface SessionCategory {
  label: string;
  sessionType: SessionType;
  intensity: IntensityLevel;
  priority: SessionPriority;
  defaultDurationMinutes: number;
  defaultRpe: number;
}

export interface IntensityDistribution {
  /** Fraction of sessions at easy intensity (0–1). */
  easy: number;
  /** Fraction of sessions at moderate intensity (0–1). */
  moderate: number;
  /** Fraction of sessions at hard intensity (0–1). */
  hard: number;
}

export interface FocusPreset {
  focus: FocusType;
  maxHardDaysPerWeek: number;
  preferredLongDay: Weekday;
  /** Ordered by scheduling priority (index 0 = highest). */
  sessionDistribution: SessionCategory[];
  defaultIntensityDistribution: IntensityDistribution;
}

// ==============================
// Presets
// ==============================

const triathlon: FocusPreset = {
  focus: "triathlon",
  maxHardDaysPerWeek: 2,
  preferredLongDay: "saturday",
  sessionDistribution: [
    { label: "Long Bike / Run Brick", sessionType: "bike",     intensity: "moderate", priority: 1, defaultDurationMinutes: 90, defaultRpe: 6 },
    { label: "Interval Run",          sessionType: "run",      intensity: "hard",     priority: 1, defaultDurationMinutes: 45, defaultRpe: 8 },
    { label: "Tempo Run",             sessionType: "run",      intensity: "moderate", priority: 2, defaultDurationMinutes: 40, defaultRpe: 7 },
    { label: "Easy Swim",             sessionType: "swim",     intensity: "easy",     priority: 2, defaultDurationMinutes: 45, defaultRpe: 4 },
    { label: "Strength",              sessionType: "strength", intensity: "moderate", priority: 2, defaultDurationMinutes: 45, defaultRpe: 6 },
    { label: "Easy Aerobic Run",      sessionType: "run",      intensity: "easy",     priority: 3, defaultDurationMinutes: 35, defaultRpe: 4 },
    { label: "Recovery / Mobility",   sessionType: "mobility", intensity: "easy",     priority: 3, defaultDurationMinutes: 30, defaultRpe: 2 },
  ],
  defaultIntensityDistribution: { easy: 0.60, moderate: 0.25, hard: 0.15 },
};

const hyrox: FocusPreset = {
  focus: "hyrox",
  maxHardDaysPerWeek: 3,
  preferredLongDay: "saturday",
  sessionDistribution: [
    { label: "Hybrid Race Sim Circuit", sessionType: "hybrid",   intensity: "hard",     priority: 1, defaultDurationMinutes: 60, defaultRpe: 9 },
    { label: "Interval Run",            sessionType: "run",      intensity: "hard",     priority: 1, defaultDurationMinutes: 40, defaultRpe: 8 },
    { label: "Strength – Lower Body",   sessionType: "strength", intensity: "hard",     priority: 2, defaultDurationMinutes: 50, defaultRpe: 8 },
    { label: "Strength – Upper Body",   sessionType: "strength", intensity: "moderate", priority: 2, defaultDurationMinutes: 45, defaultRpe: 7 },
    { label: "Aerobic Base Run",        sessionType: "run",      intensity: "easy",     priority: 2, defaultDurationMinutes: 40, defaultRpe: 4 },
    { label: "Recovery / Mobility",     sessionType: "mobility", intensity: "easy",     priority: 3, defaultDurationMinutes: 30, defaultRpe: 2 },
  ],
  defaultIntensityDistribution: { easy: 0.40, moderate: 0.30, hard: 0.30 },
};

const strength: FocusPreset = {
  focus: "strength",
  maxHardDaysPerWeek: 4,
  preferredLongDay: "saturday",
  sessionDistribution: [
    { label: "Lower Body Strength",  sessionType: "strength", intensity: "hard",     priority: 1, defaultDurationMinutes: 60, defaultRpe: 8 },
    { label: "Upper Body Strength",  sessionType: "strength", intensity: "hard",     priority: 1, defaultDurationMinutes: 55, defaultRpe: 8 },
    { label: "Full Body Strength",   sessionType: "strength", intensity: "hard",     priority: 1, defaultDurationMinutes: 60, defaultRpe: 8 },
    { label: "Zone 2 Conditioning",  sessionType: "run",      intensity: "easy",     priority: 2, defaultDurationMinutes: 40, defaultRpe: 4 },
    { label: "Accessory / Moderate", sessionType: "strength", intensity: "moderate", priority: 2, defaultDurationMinutes: 45, defaultRpe: 6 },
    { label: "Recovery / Mobility",  sessionType: "mobility", intensity: "easy",     priority: 3, defaultDurationMinutes: 30, defaultRpe: 2 },
  ],
  defaultIntensityDistribution: { easy: 0.30, moderate: 0.30, hard: 0.40 },
};

const halfMarathon: FocusPreset = {
  focus: "half_marathon",
  maxHardDaysPerWeek: 2,
  preferredLongDay: "sunday",
  sessionDistribution: [
    { label: "Long Run",           sessionType: "run",      intensity: "moderate", priority: 1, defaultDurationMinutes: 90, defaultRpe: 6 },
    { label: "Interval Run",       sessionType: "run",      intensity: "hard",     priority: 1, defaultDurationMinutes: 45, defaultRpe: 8 },
    { label: "Tempo Run",          sessionType: "run",      intensity: "hard",     priority: 2, defaultDurationMinutes: 40, defaultRpe: 7 },
    { label: "Easy Run",           sessionType: "run",      intensity: "easy",     priority: 2, defaultDurationMinutes: 35, defaultRpe: 4 },
    { label: "Strength / X-Train", sessionType: "strength", intensity: "moderate", priority: 2, defaultDurationMinutes: 40, defaultRpe: 5 },
    { label: "Recovery Run",       sessionType: "run",      intensity: "easy",     priority: 3, defaultDurationMinutes: 25, defaultRpe: 3 },
    { label: "Mobility",           sessionType: "mobility", intensity: "easy",     priority: 3, defaultDurationMinutes: 20, defaultRpe: 2 },
  ],
  defaultIntensityDistribution: { easy: 0.60, moderate: 0.25, hard: 0.15 },
};

const generalFitness: FocusPreset = {
  focus: "general_fitness",
  maxHardDaysPerWeek: 2,
  preferredLongDay: "saturday",
  sessionDistribution: [
    { label: "Cardio Endurance",    sessionType: "run",      intensity: "moderate", priority: 1, defaultDurationMinutes: 40, defaultRpe: 6 },
    { label: "Full Body Strength",  sessionType: "strength", intensity: "moderate", priority: 1, defaultDurationMinutes: 45, defaultRpe: 6 },
    { label: "Hybrid Circuit",      sessionType: "hybrid",   intensity: "hard",     priority: 2, defaultDurationMinutes: 35, defaultRpe: 8 },
    { label: "Easy Aerobic",        sessionType: "run",      intensity: "easy",     priority: 2, defaultDurationMinutes: 30, defaultRpe: 4 },
    { label: "Mobility / Recovery", sessionType: "mobility", intensity: "easy",     priority: 3, defaultDurationMinutes: 25, defaultRpe: 2 },
  ],
  defaultIntensityDistribution: { easy: 0.50, moderate: 0.35, hard: 0.15 },
};

// ==============================
// Lookup Map
// ==============================

export const FOCUS_PRESETS: Record<FocusType, FocusPreset> = {
  triathlon:       triathlon,
  hyrox:           hyrox,
  strength:        strength,
  half_marathon:   halfMarathon,
  general_fitness: generalFitness,
};

export function getPreset(focus: FocusType): FocusPreset {
  return FOCUS_PRESETS[focus];
}
