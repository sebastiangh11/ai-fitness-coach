// ==============================
// Core Focus & Modalities
// ==============================

export type FocusType =
  | "triathlon"
  | "hyrox"
  | "strength"
  | "half_marathon"
  | "general_fitness";

export type SessionType =
  | "run"
  | "bike"
  | "swim"
  | "strength"
  | "hybrid"
  | "mobility"
  | "rest";

export type IntensityLevel = "easy" | "moderate" | "hard";

export type SessionPriority = 1 | 2 | 3; 
// 1 = key session
// 2 = supporting session
// 3 = optional/recovery


// ==============================
// Athlete Constraints
// ==============================

export interface TimeBudget {
  monday?: number;
  tuesday?: number;
  wednesday?: number;
  thursday?: number;
  friday?: number;
  saturday?: number;
  sunday?: number;
}

export interface EquipmentAvailability {
  pool: boolean;
  gym: boolean;
  bikeTrainer: boolean;
  outdoorRun: boolean;
  rower?: boolean;
}

export interface AthleteConstraints {
  focus: FocusType;
  timeBudget: TimeBudget;
  equipment: EquipmentAvailability;
}


// ==============================
// Readiness & Wellness
// ==============================

export interface DailyReadiness {
  date: string; // ISO string
  readiness: 1 | 2 | 3 | 4 | 5;
  soreness?: 1 | 2 | 3 | 4 | 5;
  injuryFlag?: boolean;
  injuryNotes?: string;
}


// ==============================
// Training Sessions
// ==============================

export interface BaseSession {
  id: string;
  date: string; // ISO
  type: SessionType;
  title: string;
  description?: string;
  durationMinutes: number;
  targetRpe: number; // 1–10
  intensity: IntensityLevel;
  priority: SessionPriority;
  load: number; // duration * RPE
}

export interface CompletedSession {
  id: string;
  date: string;
  type: SessionType;
  durationMinutes: number;
  rpe: number;
  load: number;
  notes?: string;
}

export interface PlanDay {
  date: string;
  primary?: BaseSession;
  secondary?: BaseSession;
  status: "planned" | "completed" | "missed" | "modified";
}


// ==============================
// Engine Context
// ==============================

export interface TrainingHistorySummary {
  last7DayLoad: number;
  last14DayLoad: number;
  completedSessions: CompletedSession[];
}

export interface PlanContext {
  constraints: AthleteConstraints;
  readinessToday?: DailyReadiness;
  history: TrainingHistorySummary;
  existingPlan?: PlanDay[];
}


// ==============================
// Engine Outputs
// ==============================

export interface DecisionLog {
  rule: string;
  message: string;
  severity: "info" | "warning";
}

export interface PlanResult {
  plan: PlanDay[];
  weeklyLoadTarget: number;
  weeklyLoadPlanned: number;
  hardDaysCount: number;
  decisionLog: DecisionLog[];
}