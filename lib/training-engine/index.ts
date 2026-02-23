// ── Types ──────────────────────────────────────────────────────────────────
export * from "./types";

// ── Core Primitives ────────────────────────────────────────────────────────
export { computeLoad } from "./load";

// ── Plan Generation ────────────────────────────────────────────────────────
export { generateWeek } from "./generators/planGenerator";

// ── Adjustments ────────────────────────────────────────────────────────────
export { adjustAfterMiss } from "./adjusters/missAdjuster";
export type { MissEvent, MissReason, AdjustOptions, AdjustResult } from "./adjusters/missAdjuster";

// ── Evaluation ─────────────────────────────────────────────────────────────
export { summarizeAdherence, mapCompletedByDate } from "./evaluators/adherence";
export type { AdherenceSummary } from "./evaluators/adherence";

// ── Store Contract ──────────────────────────────────────────────────────────
export type { TrainingStateStore, WeekPlanSnapshot, WeekKey } from "./runtime/store";
