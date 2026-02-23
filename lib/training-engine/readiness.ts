import type { BaseSession, DailyReadiness, DecisionLog, IntensityLevel } from "./types";
import { computeLoad } from "./load";

// ==============================
// Internal Helpers
// ==============================

function recompute(session: BaseSession): BaseSession {
  return { ...session, load: computeLoad(session.durationMinutes, session.targetRpe) };
}

function reduceDuration(session: BaseSession, factor: number): BaseSession {
  return { ...session, durationMinutes: Math.round(session.durationMinutes * factor) };
}

// ==============================
// Exports
// ==============================

export function isHardIntensity(intensity: IntensityLevel): boolean {
  return intensity === "hard";
}

export function applyReadinessToSession(
  session: BaseSession | undefined,
  readiness: DailyReadiness | undefined,
  dayLabel: "today" | "tomorrow"
): { session: BaseSession | undefined; decisionLog: DecisionLog[] } {
  if (session === undefined || readiness === undefined) {
    return { session, decisionLog: [] };
  }

  const log: DecisionLog[] = [];

  // ---- Injury flag ----
  if (readiness.injuryFlag === true) {
    if (dayLabel === "today") {
      log.push({
        rule: "readiness_injury",
        message:
          `Injury flag active — "${session.title}" on ${session.date} replaced with rest. ` +
          `This is NOT medical advice; consult a qualified professional before resuming training.`,
        severity: "warning",
      });
      return { session: undefined, decisionLog: log };
    }

    // tomorrow
    const rpe = Math.min(session.targetRpe, 4);
    const duration = Math.round(session.durationMinutes * 0.7);
    if (duration < 15) {
      log.push({
        rule: "readiness_injury",
        message:
          `Injury carry-over: "${session.title}" reduced to < 15 min; converted to rest.`,
        severity: "warning",
      });
      return { session: undefined, decisionLog: log };
    }
    const injuryAdjusted = recompute({
      ...session,
      intensity: "easy",
      targetRpe: rpe,
      durationMinutes: duration,
    });
    log.push({
      rule: "readiness_injury",
      message:
        `Injury carry-over: "${session.title}" forced to easy, ` +
        `RPE capped at ${rpe}, duration reduced to ${injuryAdjusted.durationMinutes} min.`,
      severity: "warning",
    });
    return { session: injuryAdjusted, decisionLog: log };
  }

  // ---- Readiness scale ----
  const r = readiness.readiness;

  if (r >= 4) {
    return { session, decisionLog: [] };
  }

  if (r === 3) {
    let adjusted: BaseSession;
    if (isHardIntensity(session.intensity)) {
      const trimmed = reduceDuration(session, 0.85);
      adjusted = recompute({ ...trimmed, intensity: "moderate" });
      log.push({
        rule: "readiness_low",
        message:
          `Readiness 3: "${session.title}" downgraded from hard to moderate, ` +
          `duration reduced to ${adjusted.durationMinutes} min.`,
        severity: "info",
      });
    } else {
      const trimmed = reduceDuration(session, 0.9);
      adjusted = recompute(trimmed);
      log.push({
        rule: "readiness_trim",
        message:
          `Readiness 3: "${session.title}" duration reduced to ${adjusted.durationMinutes} min.`,
        severity: "info",
      });
    }
    if (adjusted.durationMinutes < 15) {
      log.push({
        rule: "readiness_trim",
        message:
          `"${session.title}" fell below 15 min after readiness 3 trim; converted to rest.`,
        severity: "info",
      });
      return { session: undefined, decisionLog: log };
    }
    return { session: adjusted, decisionLog: log };
  }

  if (r === 2) {
    const rpe = Math.max(3, session.targetRpe - 2);
    const duration = Math.round(session.durationMinutes * 0.7);
    if (duration < 15) {
      log.push({
        rule: "readiness_low",
        message:
          `Readiness 2: "${session.title}" reduced to < 15 min; converted to rest.`,
        severity: "info",
      });
      return { session: undefined, decisionLog: log };
    }
    const adjusted = recompute({
      ...session,
      intensity: "easy",
      targetRpe: rpe,
      durationMinutes: duration,
    });
    log.push({
      rule: "readiness_low",
      message:
        `Readiness 2: "${session.title}" forced to easy, ` +
        `RPE set to ${rpe}, duration reduced to ${adjusted.durationMinutes} min.`,
      severity: "info",
    });
    return { session: adjusted, decisionLog: log };
  }

  // r === 1
  if (dayLabel === "today") {
    log.push({
      rule: "readiness_low",
      message: `Readiness 1: "${session.title}" removed — forced rest today.`,
      severity: "warning",
    });
    return { session: undefined, decisionLog: log };
  }

  // tomorrow at readiness 1
  const r1Duration = Math.round(session.durationMinutes * 0.6);
  if (r1Duration < 15) {
    log.push({
      rule: "readiness_low",
      message:
        `Readiness 1 carry-over: "${session.title}" reduced to < 15 min; converted to rest.`,
      severity: "warning",
    });
    return { session: undefined, decisionLog: log };
  }
  const r1Rpe = Math.max(3, session.targetRpe - 2);
  const r1Adjusted = recompute({
    ...session,
    intensity: "easy",
    targetRpe: r1Rpe,
    durationMinutes: r1Duration,
  });
  log.push({
    rule: "readiness_low",
    message:
      `Readiness 1 carry-over: "${session.title}" forced to easy, ` +
      `RPE set to ${r1Rpe}, duration reduced to ${r1Adjusted.durationMinutes} min.`,
    severity: "warning",
  });
  return { session: r1Adjusted, decisionLog: log };
}
