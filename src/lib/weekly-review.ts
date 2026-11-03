import type { AnalyticsData } from "./analytics-types";
import { validDate, weekStart } from "./dates";
export type Reflection = {
  week: string;
  wins: string;
  challenges: string;
  priorities: string;
  version: number;
  updatedAt: number;
};
export type ReflectionText = Pick<
  Reflection,
  "wins" | "challenges" | "priorities"
>;
export const emptyReflection: ReflectionText = {
  wins: "",
  challenges: "",
  priorities: "",
};
export function isReviewWeek(value: string) {
  return validDate(value) && weekStart(value) === value;
}
export function reflectionText(value: ReflectionText): ReflectionText {
  return {
    wins: value.wins,
    challenges: value.challenges,
    priorities: value.priorities,
  };
}
export function reflectionDirty(a: ReflectionText, b: ReflectionText) {
  return (
    a.wins !== b.wins ||
    a.challenges !== b.challenges ||
    a.priorities !== b.priorities
  );
}
export function weeklyHighlights(data: AnalyticsData) {
  const eligible = data.habits.reduce((n, h) => n + h.eligible, 0);
  const met = data.habits.reduce((n, h) => n + h.successful, 0);
  const maximum = Math.max(0, ...data.days.map((d) => d.studyMs));
  return {
    eligible,
    met,
    habitRate: eligible ? (met / eligible) * 100 : null,
    mostActive: maximum ? data.days.filter((d) => d.studyMs === maximum) : [],
    scheduled: Object.values(data.summary.studyTasks).reduce(
      (a, b) => a + b,
      0,
    ),
    weeklyEligible: data.habits
      .flatMap((h) => h.weeks)
      .filter((w) => w.eligible).length,
    weeklyMet: data.habits.flatMap((h) => h.weeks).filter((w) => w.met).length,
  };
}
export type WeeklyReviewData = {
  analytics: AnalyticsData;
  reflection: Reflection | null;
  history: { week: string; updatedAt: number }[];
};
// Draft recovery is browser-session-only; it is never presented as a saved review.
export function recoverDraft(
  raw: string | null,
  week: string,
): { text: ReflectionText; version: number } | null {
  try {
    const x = JSON.parse(raw ?? "null");
    if (
      x?.week === week &&
      Number.isInteger(x.version) &&
      x.version >= 0 &&
      ["wins", "challenges", "priorities"].every(
        (k) => typeof x.text?.[k] === "string" && x.text[k].length <= 3000,
      )
    )
      return { text: reflectionText(x.text), version: x.version };
  } catch {}
  return null;
}
