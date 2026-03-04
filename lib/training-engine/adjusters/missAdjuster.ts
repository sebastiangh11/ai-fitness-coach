import type {
  PlanDay,
  BaseSession,
  PlanContext,
  DecisionLog,
  IntensityLevel,
} from "../types";
import { computeLoad } from "../load";
import { addDaysISO, isISODateOnly } from "../utils/dates";
import { getPreset } from "../config/focusPresets";
import { downgradeIntensityToEasy } from "../generators/workoutTemplates";

// ==============================
// Internal Helpers
// ==============================

function isHard(intensity: IntensityLevel): boolean {
  return intensity === "hard";
}

function clonePlan(plan: PlanDay[]): PlanDay[] {
  return plan.map((day) => ({
    ...day,
    primary: day.primary ? { ...day.primary } : undefined,
    secondary: day.secondary ? { ...day.secondary } : undefined,
  }));
}

function recomputeSessionLoad(session: BaseSession): BaseSession {
  return { ...session, load: computeLoad(session.durationMinutes, session.targetRpe) };
}

function setDayRest(
  day: PlanDay,
  reason: string,
  log: DecisionLog[],
  severity: "info" | "warning" = "warning"
): PlanDay {
  if (day.primary !== undefined) {
    log.push({
      rule: "miss_adjuster_rest",
      message: `"${day.primary.title}" on ${day.date} removed — ${reason}`,
      severity,
    });
  }
  return { ...day, primary: undefined, status: "modified" };
}

function downgradeToModerate(session: BaseSession): BaseSession {
  const rpe = Math.max(5, session.targetRpe - 1);
  return recomputeSessionLoad({ ...session, intensity: "moderate", targetRpe: rpe });
}

// ==============================
// Public API Types
// ==============================

export type MissReason =
  | "no_time"
  | "fatigue"
  | "injury"
  | "sick"
  | "travel"
  | "other";

export interface MissEvent {
  dateISO: string;
  kind: "missed" | "modified";
  reason?: MissReason;
  notes?: string;
}

export interface AdjustOptions {
  horizonDays?: 2;
  allowRebalance?: boolean;
}

export interface AdjustResult {
  plan: PlanDay[];
  decisionLog: DecisionLog[];
}

// ==============================
// Main Export
// ==============================

export function adjustAfterMiss(
  context: PlanContext,
  plan: PlanDay[],
  event: MissEvent,
  _options?: AdjustOptions
): AdjustResult {
  if (!isISODateOnly(event.dateISO)) {
    throw new Error(`adjustAfterMiss: invalid ISO date-only string "${event.dateISO}"`);
  }

  const log: DecisionLog[] = [];
  const result = clonePlan(plan);

  // Locate missed day
  const missedIdx = result.findIndex((d) => d.date === event.dateISO);
  if (missedIdx === -1) {
    log.push({
      rule: "miss_adjuster_not_found",
      message: `No plan day found for ${event.dateISO}; no adjustments applied.`,
      severity: "warning",
    });
    return { plan: result, decisionLog: log };
  }

  // Mark missed day status (leave primary intact as a record)
  result[missedIdx] = {
    ...result[missedIdx],
    status: event.kind === "missed" ? "missed" : "modified",
  };

  const missedSession: BaseSession | undefined = result[missedIdx].primary;

  // Resolve adjacent day indices by ISO date
  const nextISO = addDaysISO(event.dateISO, 1);
  const next2ISO = addDaysISO(event.dateISO, 2);
  const nextIdx = result.findIndex((d) => d.date === nextISO);
  const next2Idx = result.findIndex((d) => d.date === next2ISO);

  const isInjuryOrSick =
    event.reason === "injury" ||
    event.reason === "sick" ||
    context.readinessToday?.injuryFlag === true;

  // -------------------------------------------------------
  // Rule A — Injury / Sickness
  // -------------------------------------------------------
  if (isInjuryOrSick) {
    log.push({
      rule: "miss_adjuster_injury",
      message:
        `Injury or sickness flagged on ${event.dateISO}. Protecting the next 2 days. ` +
        `This is NOT medical advice — consult a qualified professional before resuming training.`,
      severity: "warning",
    });

    if (nextIdx !== -1) {
      result[nextIdx] = setDayRest(
        result[nextIdx],
        "injury/sickness recovery — forced rest",
        log,
        "warning"
      );
    }

    if (next2Idx !== -1 && result[next2Idx].primary !== undefined) {
      const prev = result[next2Idx].primary!;
      const eased = downgradeIntensityToEasy(prev);
      const reducedDuration = Math.round(eased.durationMinutes * 0.8);
      const adjusted = recomputeSessionLoad({ ...eased, durationMinutes: reducedDuration });
      result[next2Idx] = { ...result[next2Idx], primary: adjusted, status: "modified" };
      log.push({
        rule: "miss_adjuster_injury",
        message:
          `Day+2 "${prev.title}" on ${result[next2Idx].date} downgraded to easy ` +
          `— duration ${prev.durationMinutes} → ${adjusted.durationMinutes} min, ` +
          `RPE ${prev.targetRpe} → ${adjusted.targetRpe} (injury carry-over).`,
        severity: "info",
      });
    }

    // Injury overrides all other rules
    return { plan: result, decisionLog: log };
  }

  // -------------------------------------------------------
  // Rule B — Missed HARD session
  // -------------------------------------------------------
  if (missedSession !== undefined && isHard(missedSession.intensity)) {
    log.push({
      rule: "miss_adjuster_hard_missed",
      message:
        `Hard session "${missedSession.title}" was ${event.kind} on ${event.dateISO}. ` +
        `Not rescheduling to avoid overload.`,
      severity: "info",
    });

    // Next day: if hard, downgrade to easy (or rest if < 15 min after downgrade)
    if (nextIdx !== -1 && result[nextIdx].primary !== undefined) {
      const nextSession = result[nextIdx].primary!;
      if (isHard(nextSession.intensity)) {
        const eased = downgradeIntensityToEasy(nextSession);
        const isKey = nextSession.priority === 1;
        if (eased.durationMinutes < 15) {
          result[nextIdx] = setDayRest(
            result[nextIdx],
            "hard session missed prior day — downgrade yielded < 15 min; forced rest",
            log,
            "warning"
          );
        } else {
          const adjustedNext = recomputeSessionLoad(eased);
          result[nextIdx] = {
            ...result[nextIdx],
            primary: adjustedNext,
            status: "modified",
          };
          log.push({
            rule: "miss_adjuster_hard_missed",
            message:
              `Next day "${nextSession.title}" on ${result[nextIdx].date} downgraded ` +
              `from hard to easy — RPE ${nextSession.targetRpe} → ${adjustedNext.targetRpe}, ` +
              `duration ${nextSession.durationMinutes} → ${adjustedNext.durationMinutes} min` +
              (isKey ? " (key session — priority 1)" : "") +
              `.`,
            severity: isKey ? "warning" : "info",
          });
        }
      }
    }

    // Day+2: if hard AND next day is still hard, downgrade to moderate
    if (next2Idx !== -1 && result[next2Idx].primary !== undefined) {
      const next2Session = result[next2Idx].primary!;
      const nextDayStillHard =
        nextIdx !== -1 &&
        result[nextIdx].primary !== undefined &&
        isHard(result[nextIdx].primary!.intensity);

      if (isHard(next2Session.intensity) && nextDayStillHard) {
        const isKey = next2Session.priority === 1;
        const adjustedNext2 = downgradeToModerate(next2Session);
        result[next2Idx] = {
          ...result[next2Idx],
          primary: adjustedNext2,
          status: "modified",
        };
        log.push({
          rule: "miss_adjuster_hard_missed",
          message:
            `Day+2 "${next2Session.title}" on ${result[next2Idx].date} downgraded ` +
            `from hard to moderate — RPE ${next2Session.targetRpe} → ${adjustedNext2.targetRpe}, ` +
            `duration ${next2Session.durationMinutes} → ${adjustedNext2.durationMinutes} min ` +
            `— to avoid back-to-back hard days` +
            (isKey ? " (key session — priority 1)" : "") +
            `.`,
          severity: isKey ? "warning" : "info",
        });
      }
    }
  }

  // -------------------------------------------------------
  // Rule C — Missed EASY/MODERATE with fatigue or no_time
  // -------------------------------------------------------
  else if (event.reason === "fatigue" || event.reason === "no_time") {
    if (
      nextIdx !== -1 &&
      result[nextIdx].primary !== undefined &&
      !isHard(result[nextIdx].primary!.intensity)
    ) {
      const prev = result[nextIdx].primary!;
      const reducedDuration = Math.round(prev.durationMinutes * 0.85);
      const adjusted = recomputeSessionLoad({ ...prev, durationMinutes: reducedDuration });
      result[nextIdx] = { ...result[nextIdx], primary: adjusted, status: "modified" };
      log.push({
        rule: "miss_adjuster_fatigue",
        message:
          `${event.reason === "fatigue" ? "Fatigue" : "Time constraint"} noted — ` +
          `"${prev.title}" on ${result[nextIdx].date} duration reduced from ${prev.durationMinutes} ` +
          `to ${adjusted.durationMinutes} min (15% cut; load ${prev.load} → ${adjusted.load}).`,
        severity: "info",
      });
    }
  }

  // -------------------------------------------------------
  // Rule D — Both next days still hard: keep higher priority, downgrade the other
  // -------------------------------------------------------
  const nextIsHard =
    nextIdx !== -1 &&
    result[nextIdx].primary !== undefined &&
    isHard(result[nextIdx].primary!.intensity);

  const next2IsHard =
    next2Idx !== -1 &&
    result[next2Idx].primary !== undefined &&
    isHard(result[next2Idx].primary!.intensity);

  if (nextIsHard && next2IsHard) {
    const nextPriority = result[nextIdx].primary!.priority;
    const next2Priority = result[next2Idx].primary!.priority;

    if (next2Priority >= nextPriority) {
      // next2 is equal or lower priority — downgrade next2 to moderate
      const prev = result[next2Idx].primary!;
      const adjustedNext2D = downgradeToModerate(prev);
      result[next2Idx] = {
        ...result[next2Idx],
        primary: adjustedNext2D,
        status: "modified",
      };
      log.push({
        rule: "miss_adjuster_back_to_back",
        message:
          `Both day+1 and day+2 are hard. Downgraded lower-priority ` +
          `"${prev.title}" on ${result[next2Idx].date} from hard to moderate ` +
          `— RPE ${prev.targetRpe} → ${adjustedNext2D.targetRpe}, ` +
          `duration ${prev.durationMinutes} → ${adjustedNext2D.durationMinutes} min.`,
        severity: "info",
      });
    } else {
      // next day is lower priority — downgrade next to easy
      const prev = result[nextIdx].primary!;
      const adjustedNextD = recomputeSessionLoad(downgradeIntensityToEasy(prev));
      result[nextIdx] = {
        ...result[nextIdx],
        primary: adjustedNextD,
        status: "modified",
      };
      log.push({
        rule: "miss_adjuster_back_to_back",
        message:
          `Both day+1 and day+2 are hard. Downgraded lower-priority ` +
          `"${prev.title}" on ${result[nextIdx].date} from hard to easy ` +
          `— RPE ${prev.targetRpe} → ${adjustedNextD.targetRpe}, ` +
          `duration ${prev.durationMinutes} → ${adjustedNextD.durationMinutes} min.`,
        severity: "info",
      });
    }
  }

  // -------------------------------------------------------
  // Rule F — Hard cap within 3-day window (light touch)
  // -------------------------------------------------------
  // Derive a local cap from the preset's weekly limit, capped at 2 since the
  // window is only 3 days. A preset with maxHardDaysPerWeek === 1 propagates.
  const preset = getPreset(context.constraints.focus);
  const windowHardCap = Math.min(2, preset.maxHardDaysPerWeek);

  const windowIndices = [missedIdx, nextIdx, next2Idx].filter((i): i is number => i !== -1);
  const hardInWindow = windowIndices.filter(
    (i) =>
      result[i].status !== "missed" &&
      result[i].primary !== undefined &&
      isHard(result[i].primary!.intensity)
  );

  if (hardInWindow.length > windowHardCap) {
    // Find the lowest-priority hard session in the window (highest priority number)
    const toDowngradeIdx = hardInWindow.reduce((worst, i) =>
      result[i].primary!.priority > result[worst].primary!.priority ? i : worst
    );
    const prev = result[toDowngradeIdx].primary!;
    const adjustedHardCap = downgradeToModerate(prev);
    result[toDowngradeIdx] = {
      ...result[toDowngradeIdx],
      primary: adjustedHardCap,
      status: "modified",
    };
    log.push({
      rule: "miss_adjuster_hard_cap",
      message:
        `Hard session count in 3-day window (${hardInWindow.length}) exceeded cap of ${windowHardCap}. ` +
        `Downgraded lowest-priority "${prev.title}" on ${result[toDowngradeIdx].date} ` +
        `from hard to moderate — RPE ${prev.targetRpe} → ${adjustedHardCap.targetRpe}, ` +
        `duration ${prev.durationMinutes} → ${adjustedHardCap.durationMinutes} min.`,
      severity: "info",
    });
  }

  return { plan: result, decisionLog: log };
}
