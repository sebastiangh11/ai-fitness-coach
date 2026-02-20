import type { SessionCategory } from "../config/focusPresets";
import type { BaseSession } from "../types";
import { computeLoad } from "../load";

// Convert a human-readable label into a URL-safe key, e.g. "Interval Run" → "interval_run"
function labelToKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function buildSessionFromCategory(
  category: SessionCategory,
  dateISO: string
): BaseSession {
  const key = labelToKey(category.label);
  const duration = category.defaultDurationMinutes;
  const rpe = category.defaultRpe;

  return {
    id: `${key}-${dateISO}`,
    date: dateISO,
    type: category.sessionType,
    title: category.label,
    description: `${category.label} session — adjust details before finalizing.`,
    durationMinutes: duration,
    targetRpe: rpe,
    intensity: category.intensity,
    priority: category.priority,
    load: computeLoad(duration, rpe),
  };
}

export function scaleSessionDuration(
  session: BaseSession,
  maxAvailableMinutes: number
): BaseSession {
  if (session.durationMinutes <= maxAvailableMinutes) {
    return session;
  }

  const duration = maxAvailableMinutes;

  return {
    ...session,
    durationMinutes: duration,
    load: computeLoad(duration, session.targetRpe),
  };
}

export function downgradeIntensityToEasy(session: BaseSession): BaseSession {
  const rpe = Math.max(3, session.targetRpe - 2);
  const duration = Math.round(session.durationMinutes * 0.8);

  return {
    ...session,
    intensity: "easy",
    targetRpe: rpe,
    durationMinutes: duration,
    load: computeLoad(duration, rpe),
  };
}
