import { describe, it, expect } from "vitest";
import { getCoachInsight } from "./coachInsight";
import type { CoachInsightInput } from "./coachInsight";

const base: CoachInsightInput = {
  todayStatus: "planned",
  adherencePct: 50,
  plannedLoad: 1000,
  completedLoad: 500,
  sessionsPlanned: 5,
  sessionsCompleted: 2,
  sessionsMissed: 0,
};

describe("getCoachInsight", () => {
  it("missed: warning tone with load and remaining-sessions note", () => {
    const result = getCoachInsight({
      ...base,
      todayStatus: "missed",
      adherencePct: 40,
      completedLoad: 400,
    });
    expect(result.tone).toBe("warning");
    expect(result.lines.join(" ")).toContain("Miss recorded");
    expect(result.lines.join(" ")).toContain("600"); // remainingLoad = 1000 - 400
  });

  it("done + hard intensity: positive tone with recovery note", () => {
    const result = getCoachInsight({
      ...base,
      todayStatus: "done",
      todayIntensity: "hard",
      adherencePct: 55,
    });
    expect(result.tone).toBe("positive");
    expect(result.lines.join(" ")).toMatch(/recovery/i);
  });

  it("planned + low adherence (<25%): neutral tone emphasising consistency", () => {
    const result = getCoachInsight({
      ...base,
      todayStatus: "planned",
      adherencePct: 15,
    });
    expect(result.tone).toBe("neutral");
    expect(result.lines.join(" ")).toMatch(/consistency/i);
  });

  it("planned + high adherence (>70%): neutral tone with finish-strong message", () => {
    const result = getCoachInsight({
      ...base,
      todayStatus: "planned",
      adherencePct: 80,
    });
    expect(result.tone).toBe("neutral");
    expect(result.lines.join(" ")).toContain("80");
  });

  it("week target achieved (remainingLoad <= 0): positive shortcut message", () => {
    const result = getCoachInsight({
      ...base,
      todayStatus: "planned",
      completedLoad: 1000, // remainingLoad = 0
    });
    expect(result.tone).toBe("positive");
    expect(result.lines.join(" ")).toMatch(/week target achieved/i);
  });

  it("missed + low adherence: warning includes consistency note", () => {
    const result = getCoachInsight({
      ...base,
      todayStatus: "missed",
      adherencePct: 10,
      completedLoad: 100,
    });
    expect(result.tone).toBe("warning");
    expect(result.lines.join(" ")).toMatch(/consistency/i);
  });

  it("done + high adherence: positive tone with finish-strong message", () => {
    const result = getCoachInsight({
      ...base,
      todayStatus: "done",
      adherencePct: 75,
    });
    expect(result.tone).toBe("positive");
    expect(result.lines.join(" ")).toMatch(/75%.*finish.*week|finish.*strong/i);
  });
});
