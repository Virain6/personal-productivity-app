import { DateTime } from "luxon";
import { addDays, validDate, weekStart } from "./dates";
import type { AnalyticsRange } from "./analytics-types";
export type RangePreset = "week" | "lastWeek" | "month" | "custom";
export function rangeError({ from, to }: AnalyticsRange) {
  if (!validDate(from) || !validDate(to))
    return "Choose valid start and end dates.";
  if (to < from) return "End date must be on or after start date.";
  if (to > addDays(from, 92)) return "Choose a range of at most 93 days.";
  return "";
}
export function presetRange(
  preset: Exclude<RangePreset, "custom">,
  today: string,
): AnalyticsRange {
  if (preset === "month") {
    const month = DateTime.fromISO(today, { zone: "UTC" });
    return {
      from: month.startOf("month").toISODate()!,
      to: month.endOf("month").toISODate()!,
    };
  }
  const from = addDays(weekStart(today), preset === "lastWeek" ? -7 : 0);
  return { from, to: addDays(from, 6) };
}
export function shiftRange(
  range: AnalyticsRange,
  preset: RangePreset,
  direction: number,
): AnalyticsRange {
  if (preset === "month")
    return presetRange(
      "month",
      DateTime.fromISO(range.from, { zone: "UTC" })
        .plus({ months: direction })
        .toISODate()!,
    );
  const length =
    DateTime.fromISO(range.to, { zone: "UTC" }).diff(
      DateTime.fromISO(range.from, { zone: "UTC" }),
      "days",
    ).days + 1;
  return {
    from: addDays(range.from, length * direction),
    to: addDays(range.to, length * direction),
  };
}
