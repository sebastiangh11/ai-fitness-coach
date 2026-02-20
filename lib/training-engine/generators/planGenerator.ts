import type {
  PlanContext,
  PlanResult,
  PlanDay,
  DecisionLog,
  IntensityLevel,
  BaseSession,
  DailyReadiness,
} from "../types";
import { getPreset, type SessionCategory, type Weekday } from "../config/focusPresets";
import { getWeekDates, getWeekday, getTimeBudgetForDate } from "../utils/dates";
import { computeLoad } from "../load";
import {
  buildSessionFromCategory,
  scaleSessionDuration,
  downgradeIntensityToEasy,
} from "./workoutTemplates";

// ==============================
// Constants
// ==============================

const MIN_SESSION_MINUTES = 15;

// ==============================
// Internal Session Helpers
// ==============================

function buildSession(category: SessionCategory, dateISO: string): BaseSession {
  return buildSessionFromCategory(category, dateISO);
}

function withRecomputedLoad(session: BaseSession): BaseSession {
  return { ...session, load: computeLoad(session.durationMinutes, session.targetRpe) };
}

function enforceMinDuration(session: BaseSession): BaseSession {
  if (session.durationMinutes >= MIN_SESSION_MINUTES) return session;
  return {
    ...session,
    type: "mobility",
    intensity: "easy",
    targetRpe: 2,
    durationMinutes: MIN_SESSION_MINUTES,
    load: computeLoad(MIN_SESSION_MINUTES, 2),
    title: "Recovery Mobility",
    description: "Converted to mobility — duration fell below minimum threshold.",
  };
}

function downgradeToModerate(session: BaseSession): BaseSession {
  const rpe = Math.max(5, session.targetRpe - 1);
  return withRecomputedLoad({ ...session, intensity: "moderate", targetRpe: rpe });
}

// ==============================
// Exported Helpers
// ==============================

export function isHardIntensity(intensity: IntensityLevel): boolean {
  return intensity === "hard";
}

export function countHardDays(plan: PlanDay[]): number {
  return plan.filter(
    (day) => day.primary !== undefined && isHardIntensity(day.primary.intensity)
  ).length;
}

// ==============================
// Phase 2 Pass Helpers
// ==============================

function applyTimeBudget(
  plan: PlanDay[],
  context: PlanContext,
  log: DecisionLog[]
): void {
  for (const day of plan) {
    if (!day.primary) continue;

    const budget = getTimeBudgetForDate(context.constraints.timeBudget, day.date, 0);

    if (budget === 0 || budget < MIN_SESSION_MINUTES) {
      log.push({
        rule: "time_budget_trim",
        message:
          `No usable time budget for ${getWeekday(day.date)} (${day.date}); ` +
          `session "${day.primary.title}" removed — day set to rest.`,
        severity: "warning",
      });
      day.primary = undefined;
      continue;
    }

    if (day.primary.durationMinutes > budget) {
      const prev = day.primary;
      const scaled = enforceMinDuration(scaleSessionDuration(prev, budget));
      log.push({
        rule: "time_budget_trim",
        message:
          `"${prev.title}" on ${day.date} scaled from ${prev.durationMinutes} min ` +
          `to ${scaled.durationMinutes} min to fit time budget of ${budget} min.`,
        severity: "info",
      });
      day.primary = scaled;
    }
  }
}

function applyReadiness(
  plan: PlanDay[],
  readiness: DailyReadiness,
  log: DecisionLog[]
): void {
  const todayIdx = plan.findIndex((d) => d.date === readiness.date);
  if (todayIdx === -1) return;

  const tomorrowIdx = todayIdx + 1 < plan.length ? todayIdx + 1 : -1;

  // Injury flag: overrides everything for today and tomorrow
  if (readiness.injuryFlag) {
    log.push({
      rule: "readiness_downgrade",
      message:
        `Injury flag active for ${readiness.date}: today and tomorrow forced to easy/mobility. ` +
        `This is NOT medical advice — consult a qualified professional before resuming training.`,
      severity: "warning",
    });
    if (plan[todayIdx].primary) {
      plan[todayIdx].primary = enforceMinDuration(
        withRecomputedLoad({
          ...downgradeIntensityToEasy(plan[todayIdx].primary!),
          type: "mobility",
        })
      );
    }
    if (tomorrowIdx !== -1 && plan[tomorrowIdx].primary) {
      plan[tomorrowIdx].primary = enforceMinDuration(
        downgradeIntensityToEasy(plan[tomorrowIdx].primary!)
      );
    }
    return;
  }

  const r = readiness.readiness;

  if (r === 1) {
    if (plan[todayIdx].primary) {
      log.push({
        rule: "readiness_downgrade",
        message:
          `Readiness 1 on ${readiness.date}: forced rest — ` +
          `session "${plan[todayIdx].primary!.title}" removed.`,
        severity: "warning",
      });
      plan[todayIdx].primary = undefined;
    }
    if (tomorrowIdx !== -1 && plan[tomorrowIdx].primary) {
      const tomorrow = plan[tomorrowIdx].primary!;
      if (tomorrow.intensity !== "easy") {
        plan[tomorrowIdx].primary = enforceMinDuration(downgradeIntensityToEasy(tomorrow));
        log.push({
          rule: "readiness_downgrade",
          message:
            `Readiness 1 carry-over: "${tomorrow.title}" on ${plan[tomorrowIdx].date} ` +
            `downgraded to easy.`,
          severity: "info",
        });
      }
    }
  } else if (r === 2) {
    if (plan[todayIdx].primary) {
      const prev = plan[todayIdx].primary!;
      const eased = downgradeIntensityToEasy(prev);
      const reducedDuration = Math.round(eased.durationMinutes * 0.7);
      const adjusted = enforceMinDuration(
        withRecomputedLoad({ ...eased, durationMinutes: reducedDuration })
      );
      log.push({
        rule: "readiness_downgrade",
        message:
          `Readiness 2 on ${readiness.date}: "${prev.title}" downgraded to easy ` +
          `and duration reduced to ${adjusted.durationMinutes} min.`,
        severity: "info",
      });
      plan[todayIdx].primary = adjusted;
    }
  } else if (r === 3) {
    if (plan[todayIdx].primary) {
      const prev = plan[todayIdx].primary!;
      let adjusted: BaseSession;

      if (isHardIntensity(prev.intensity)) {
        adjusted = enforceMinDuration(downgradeIntensityToEasy(prev));
        log.push({
          rule: "readiness_downgrade",
          message:
            `Readiness 3 on ${readiness.date}: hard session "${prev.title}" ` +
            `downgraded to easy.`,
          severity: "info",
        });
      } else if (prev.intensity === "moderate") {
        const reducedDuration = Math.round(prev.durationMinutes * 0.85);
        adjusted = enforceMinDuration(
          withRecomputedLoad({ ...prev, durationMinutes: reducedDuration })
        );
        log.push({
          rule: "readiness_downgrade",
          message:
            `Readiness 3 on ${readiness.date}: moderate session "${prev.title}" ` +
            `duration reduced to ${adjusted.durationMinutes} min.`,
          severity: "info",
        });
      } else {
        adjusted = prev; // easy — no change at readiness 3
      }

      plan[todayIdx].primary = adjusted;
    }
  }
  // readiness 4–5: no change
}

function enforceHardDayCap(
  plan: PlanDay[],
  maxHardDaysPerWeek: number,
  log: DecisionLog[]
): void {
  let hardCount = countHardDays(plan);
  if (hardCount <= maxHardDaysPerWeek) return;

  // Sort hard days by priority descending — highest number (lowest priority) demoted first
  const hardDays = plan
    .filter((d) => d.primary !== undefined && isHardIntensity(d.primary.intensity))
    .sort((a, b) => b.primary!.priority - a.primary!.priority);

  for (const day of hardDays) {
    if (hardCount <= maxHardDaysPerWeek) break;
    const prev = day.primary!;
    day.primary = downgradeToModerate(prev);
    log.push({
      rule: "hard_day_cap",
      message:
        `Hard day cap (${maxHardDaysPerWeek}/week) exceeded — ` +
        `downgraded "${prev.title}" on ${day.date} from hard to moderate.`,
      severity: "info",
    });
    hardCount--;
  }
}

function computeWeeklyLoad(plan: PlanDay[]): number {
  return plan.reduce((sum, day) => sum + (day.primary?.load ?? 0), 0);
}

function applyRampCap(
  plan: PlanDay[],
  weeklyLoadPlanned: number,
  context: PlanContext,
  log: DecisionLog[]
): { weeklyLoadTarget: number; weeklyLoadPlanned: number } {
  const last7 = context.history.last7DayLoad;

  // No prior load history — skip cap to avoid zeroing out new athletes
  if (last7 === 0) {
    return { weeklyLoadTarget: weeklyLoadPlanned, weeklyLoadPlanned };
  }

  const readiness = context.readinessToday;
  const lowReadiness =
    readiness !== undefined &&
    (readiness.readiness <= 2 || readiness.injuryFlag === true);
  const ramp = lowReadiness ? 1.05 : 1.1;

  const weeklyLoadTarget = Math.min(weeklyLoadPlanned, last7 * ramp);

  if (weeklyLoadPlanned <= weeklyLoadTarget) {
    return { weeklyLoadTarget, weeklyLoadPlanned };
  }

  const ratio = weeklyLoadTarget / weeklyLoadPlanned;

  log.push({
    rule: "weekly_ramp_cap",
    message:
      `Planned load (${Math.round(weeklyLoadPlanned)}) exceeds ramp cap ` +
      `(${Math.round(weeklyLoadTarget)} = ${last7} × ${ramp}). ` +
      `Scaling easy then moderate sessions by ratio ${ratio.toFixed(2)}.`,
    severity: "warning",
  });

  // Scale easy sessions first
  for (const day of plan) {
    if (!day.primary || day.primary.intensity !== "easy") continue;
    const newDuration = Math.max(
      MIN_SESSION_MINUTES,
      Math.round(day.primary.durationMinutes * ratio)
    );
    day.primary = enforceMinDuration(
      withRecomputedLoad({ ...day.primary, durationMinutes: newDuration })
    );
  }

  let currentLoad = computeWeeklyLoad(plan);

  // Scale moderate sessions if still over cap
  if (currentLoad > weeklyLoadTarget) {
    const modRatio = weeklyLoadTarget / currentLoad;
    for (const day of plan) {
      if (!day.primary || day.primary.intensity !== "moderate") continue;
      const newDuration = Math.max(
        MIN_SESSION_MINUTES,
        Math.round(day.primary.durationMinutes * modRatio)
      );
      day.primary = enforceMinDuration(
        withRecomputedLoad({ ...day.primary, durationMinutes: newDuration })
      );
    }
    currentLoad = computeWeeklyLoad(plan);
  }

  return { weeklyLoadTarget, weeklyLoadPlanned: currentLoad };
}

// ==============================
// Core Skeleton Scheduler
// ==============================

export function generateSkeletonDays(
  categories: SessionCategory[],
  weekDates: string[],
  preferredLongDay: Weekday
): { plan: PlanDay[]; decisionLog: DecisionLog[] } {
  const decisionLog: DecisionLog[] = [];

  // Initialise 7 empty plan days
  const plan: PlanDay[] = weekDates.map((date) => ({
    date,
    status: "planned" as const,
  }));

  // Edge case: no categories at all
  if (categories.length === 0) {
    decisionLog.push({
      rule: "empty-distribution",
      message:
        "sessionDistribution is empty; returning 7 rest days with no primary sessions.",
      severity: "warning",
    });
    return { plan, decisionLog };
  }

  // Work from a copy so we can mutate safely
  const remaining: SessionCategory[] = [...categories];

  // Edge case: more categories than days — drop lowest-priority tail
  if (remaining.length > weekDates.length) {
    const dropped = remaining.splice(weekDates.length);
    decisionLog.push({
      rule: "overflow-categories",
      message:
        `${categories.length} categories exceed ${weekDates.length} available days. ` +
        `Dropped ${dropped.length} category/categories: ` +
        dropped.map((c) => `"${c.label}"`).join(", ") +
        ".",
      severity: "warning",
    });
  }

  // ---- Step A: Anchor the long / first category on preferredLongDay ----

  const longIdx = remaining.findIndex((c) =>
    c.label.toLowerCase().includes("long")
  );
  const anchorIdx = longIdx !== -1 ? longIdx : 0;
  const anchorCategory = remaining[anchorIdx];

  const preferredDayIdx = weekDates.findIndex(
    (d) => getWeekday(d) === preferredLongDay
  );

  if (preferredDayIdx !== -1) {
    plan[preferredDayIdx].primary = buildSession(
      anchorCategory,
      weekDates[preferredDayIdx]
    );
    decisionLog.push({
      rule: "preferred-long-day",
      message:
        `Placed "${anchorCategory.label}" on ${preferredLongDay} (${weekDates[preferredDayIdx]}) ` +
        `as the anchor/long session per preset preference.`,
      severity: "info",
    });
  } else {
    plan[0].primary = buildSession(anchorCategory, weekDates[0]);
    decisionLog.push({
      rule: "preferred-long-day-fallback",
      message:
        `Preferred long day "${preferredLongDay}" was not found in the provided week dates. ` +
        `Placed "${anchorCategory.label}" on the first available day (${weekDates[0]}) instead.`,
      severity: "warning",
    });
  }

  remaining.splice(anchorIdx, 1);

  // ---- Step B: Place each remaining category on the earliest valid day ----

  for (const category of remaining) {
    const candidateIsHard = isHardIntensity(category.intensity);
    let placed = false;

    for (let i = 0; i < plan.length; i++) {
      if (plan[i].primary !== undefined) continue;

      if (candidateIsHard) {
        const prevIsHard =
          i > 0 &&
          plan[i - 1].primary !== undefined &&
          isHardIntensity(plan[i - 1].primary!.intensity);

        const nextIsHard =
          i < plan.length - 1 &&
          plan[i + 1].primary !== undefined &&
          isHardIntensity(plan[i + 1].primary!.intensity);

        if (prevIsHard || nextIsHard) continue;
      }

      plan[i].primary = buildSession(category, weekDates[i]);
      decisionLog.push({
        rule: "schedule-session",
        message: `Placed "${category.label}" on ${getWeekday(weekDates[i])} (${weekDates[i]}).`,
        severity: "info",
      });
      placed = true;
      break;
    }

    if (!placed) {
      const fallbackIdx = plan.findIndex((d) => d.primary === undefined);
      if (fallbackIdx !== -1) {
        plan[fallbackIdx].primary = buildSession(category, weekDates[fallbackIdx]);
        decisionLog.push({
          rule: "hard-spacing-compromise",
          message:
            `No slot satisfying the back-to-back hard day rule was found for ` +
            `"${category.label}". Placed it on ` +
            `${getWeekday(weekDates[fallbackIdx])} (${weekDates[fallbackIdx]}) ` +
            `as a compromise — consider redistributing sessions or reducing hard session count.`,
          severity: "warning",
        });
      } else {
        decisionLog.push({
          rule: "no-available-day",
          message: `All 7 days are already occupied; "${category.label}" could not be placed and was dropped.`,
          severity: "warning",
        });
      }
    }
  }

  return { plan, decisionLog };
}

// ==============================
// Public Entry Point
// ==============================

export function generateWeek(
  context: PlanContext,
  weekStartISO: string
): PlanResult {
  const preset = getPreset(context.constraints.focus);
  const weekDates = getWeekDates(weekStartISO, 7);

  const { plan, decisionLog } = generateSkeletonDays(
    preset.sessionDistribution,
    weekDates,
    preset.preferredLongDay
  );

  // Phase 2a: time budget scaling (load already real from buildSessionFromCategory)
  applyTimeBudget(plan, context, decisionLog);

  // Phase 2b: readiness adjustments for today and next day
  if (context.readinessToday) {
    applyReadiness(plan, context.readinessToday, decisionLog);
  }

  // Phase 2c: enforce hard day cap
  enforceHardDayCap(plan, preset.maxHardDaysPerWeek, decisionLog);

  // Phase 2d: final minimum-duration pass (catches any sub-15 min results from adjustments)
  for (const day of plan) {
    if (day.primary && day.primary.durationMinutes < MIN_SESSION_MINUTES) {
      const prev = day.primary;
      day.primary = enforceMinDuration(prev);
      decisionLog.push({
        rule: "time_budget_trim",
        message:
          `Session "${prev.title}" on ${day.date} fell below ${MIN_SESSION_MINUTES} min ` +
          `after adjustments; converted to recovery mobility.`,
        severity: "info",
      });
    }
  }

  // Phase 2e: compute load totals and apply weekly ramp cap
  const weeklyLoadPlanned = computeWeeklyLoad(plan);
  const { weeklyLoadTarget, weeklyLoadPlanned: finalLoad } = applyRampCap(
    plan,
    weeklyLoadPlanned,
    context,
    decisionLog
  );

  return {
    plan,
    weeklyLoadTarget,
    weeklyLoadPlanned: finalLoad,
    hardDaysCount: countHardDays(plan),
    decisionLog,
  };
}
