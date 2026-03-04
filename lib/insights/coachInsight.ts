export type CoachInsightInput = {
  focus?: string;
  todayStatus: "planned" | "done" | "missed" | "modified";
  todayIntensity?: "easy" | "moderate" | "hard" | string;
  adherencePct: number;
  plannedLoad: number;
  completedLoad: number;
  sessionsPlanned: number;
  sessionsCompleted: number;
  sessionsMissed: number;
};

export type CoachInsightResult = {
  title: string;
  lines: string[];
  tone: "neutral" | "positive" | "warning";
};

const TITLE = "AI Coach Insight 🧠";

export function getCoachInsight(input: CoachInsightInput): CoachInsightResult {
  const {
    todayStatus,
    todayIntensity,
    adherencePct,
    plannedLoad,
    completedLoad,
    sessionsPlanned,
    sessionsCompleted,
    sessionsMissed,
  } = input;

  const remainingLoad = plannedLoad - completedLoad;
  const remainingSessions =
    sessionsPlanned - sessionsCompleted - sessionsMissed;

  // ── Shortcut: week target already achieved ─────────────────────────────────
  if (remainingLoad <= 0 && todayStatus !== "missed") {
    return {
      title: TITLE,
      lines: [
        "Week target achieved — you've hit your load goal.",
        "Keep moving, but don't push into excess.",
      ],
      tone: "positive",
    };
  }

  // ── Missed ─────────────────────────────────────────────────────────────────
  if (todayStatus === "missed") {
    const lines = [
      "Miss recorded — keep tomorrow steady and don't try to compensate.",
      remainingLoad > 0
        ? `${remainingLoad} load units remain across ${remainingSessions} session${remainingSessions !== 1 ? "s" : ""}.`
        : "You've already covered your load target for the week.",
    ];
    if (adherencePct < 25) {
      lines.push("Consistency is the priority right now — small steps add up.");
    }
    return { title: TITLE, lines, tone: "warning" };
  }

  // ── Done / modified ────────────────────────────────────────────────────────
  if (todayStatus === "done" || todayStatus === "modified") {
    let lines: string[];
    if (todayIntensity === "hard") {
      lines = [
        "Great work today — that was a hard effort.",
        "Prioritize sleep and an easy recovery tomorrow.",
      ];
    } else if (adherencePct > 70) {
      lines = [
        "Solid progress this week.",
        `You're at ${Math.round(adherencePct)}% adherence — finish strong.`,
      ];
    } else if (adherencePct < 25) {
      lines = [
        "Session done! Every session you complete builds the habit.",
        "Consistency is the key to long-term progress.",
      ];
    } else {
      lines = [
        "Session complete.",
        `You're at ${Math.round(adherencePct)}% of your weekly load target — keep it up.`,
      ];
    }
    return { title: TITLE, lines, tone: "positive" };
  }

  // ── Planned (default) ──────────────────────────────────────────────────────
  let lines: string[];
  if (adherencePct < 25) {
    lines = [
      "Today's session is important.",
      "Consistency early in the week sets the tone. Don't skip it.",
    ];
  } else if (adherencePct > 70) {
    lines = [
      `You're at ${Math.round(adherencePct)}% adherence.`,
      "Finish the week strong with today's session.",
    ];
  } else {
    lines = ["Complete today's session to stay on track."];
    if (remainingSessions > 0) {
      lines.push(`${remainingSessions} session${remainingSessions !== 1 ? "s" : ""} left this week.`);
    }
  }
  return { title: TITLE, lines, tone: "neutral" };
}
