import { DateTime } from "luxon";
import { addDays, weekStart } from "./dates";
import {
  habitOutcome,
  habitDirection,
  habitResult,
  type HabitConfig,
  type HabitDay,
} from "./habit-types";
export type ActivityState =
  | "met"
  | "missed"
  | "below"
  | "exceeded"
  | "recorded"
  | "rest"
  | "unscheduled"
  | "future"
  | "unlogged"
  | "unknown";
export type ActivityCell = {
  date: string;
  state: ActivityState;
  detail: string;
  amount?: number;
};
export type HabitAnalytics = {
  id: string;
  name: string;
  archived: boolean;
  days: ActivityCell[];
  logged: number;
  met: number;
  eligible: number;
  successful: number;
  rate: number | null;
  latestRun: number | null;
  longestRun: number | null;
  dailyTrend: { date: string; eligible: number; met: number }[];
  weeks: {
    date: string;
    goalDays: number;
    target: number | null;
    eligible: boolean;
    met: boolean;
  }[];
  quantities: {
    unit: string;
    total: number;
    average: number;
    days: { date: string; value: number | null; target: number | null }[];
  }[];
  workouts: { name: string; count: number }[];
};
export function expectedHabitDate(config: HabitConfig, date: string) {
  return (
    config.schedule === "daily" ||
    (config.schedule === "weekdays" &&
      config.weekdays.includes(DateTime.fromISO(date, { zone: "UTC" }).weekday))
  );
}
export function measurableGoal(config: HabitConfig) {
  return !(
    config.kind === "quantity" &&
    habitDirection(config) === "build" &&
    (config.goal === "awareness" || config.target === null)
  );
}
export function summarizeHabitActivity(
  id: string,
  name: string,
  archived: boolean,
  source: HabitDay[],
  today: string,
): HabitAnalytics {
  const result: HabitAnalytics = {
    id,
    name,
    archived,
    days: [],
    logged: 0,
    met: 0,
    eligible: 0,
    successful: 0,
    rate: null,
    latestRun: null,
    longestRun: null,
    weeks: [],
    dailyTrend: [],
    quantities: [],
    workouts: [],
  };
  const unitRows = new Map<
    string,
    Map<string, { value: number | null; target: number | null }>
  >();
  const workouts = new Map<string, number>();
  let run = 0,
    longest = 0,
    hasDailyGoals = false,
    priorRule = "";
  for (const day of source) {
    const cfg = day.config,
      outcome = cfg ? habitOutcome(cfg, day.record) : "unlogged";
    const uncertainRest =
      outcome === "unlogged" &&
      cfg?.kind === "workout" &&
      cfg.rotation.some((name) => name.trim().toLowerCase() === "rest");
    const past = day.date < today;
    const logged = !["unlogged", "rest"].includes(outcome);
    const state: ActivityState =
      day.date > today
        ? "future"
        : !cfg
          ? "unscheduled"
          : outcome === "unlogged"
            ? archived || uncertainRest
              ? "unknown"
              : day.expected
                ? past
                  ? "missed"
                  : "unlogged"
                : "unscheduled"
            : outcome;
    const detail =
      day.date > today
        ? "Future · not evaluated"
        : !cfg
          ? "Before habit creation"
          : outcome === "unlogged"
            ? archived || uncertainRest
              ? uncertainRest
                ? "Unknown · no saved workout/rest decision"
                : "Unknown · archive dates are not recorded"
              : day.expected
                ? "Expected · not logged"
                : cfg.schedule === "weekly"
                  ? "Flexible weekly schedule · not logged"
                  : "Not scheduled"
            : `${habitResult(cfg, day.record)}${!day.expected && cfg.schedule !== "weekly" ? " · Unscheduled entry" : ""}`;
    result.days.push({ date: day.date, state, detail });
    if (!cfg || day.date > today) continue;
    if (logged) result.logged++;
    if (outcome === "met") result.met++;
    const goal = measurableGoal(cfg);
    // Only elapsed expected days enter adherence. Archived absence is not evidence.
    const eligible =
      past &&
      day.expected &&
      goal &&
      outcome !== "rest" &&
      (!archived || logged) &&
      !uncertainRest;
    if (eligible) {
      const week = weekStart(day.date);
      let bucket = result.dailyTrend.find((w) => w.date === week);
      if (!bucket) {
        bucket = { date: week, eligible: 0, met: 0 };
        result.dailyTrend.push(bucket);
      }
      bucket.eligible++;
      if (outcome === "met") bucket.met++;
      result.eligible++;
      if (outcome === "met") result.successful++;
    }
    if (cfg.schedule !== "weekly" && goal) {
      hasDailyGoals = true;
      const rule = JSON.stringify([
        cfg.kind,
        cfg.direction,
        cfg.goal,
        cfg.target,
        cfg.unit,
        cfg.schedule,
        cfg.weekdays,
      ]);
      if (priorRule && priorRule !== rule) run = 0;
      priorRule = rule;
      if (day.expected && outcome !== "rest" && (past || logged)) {
        run = outcome === "met" ? run + 1 : 0;
        longest = Math.max(longest, run);
      }
    } else {
      run = 0;
      priorRule = "";
    }
    if (cfg.kind === "quantity") {
      const rows = unitRows.get(cfg.unit) ?? new Map();
      const target = !goal ? null : cfg.direction === "avoid" ? 0 : cfg.target;
      rows.set(day.date, {
        value:
          logged && day.record?.quantityMilli !== null
            ? (day.record?.quantityMilli ?? 0) / 1000
            : null,
        target,
      });
      unitRows.set(cfg.unit, rows);
    }
    if (cfg.kind === "workout" && day.record?.state === "done") {
      const workout = day.record.workout || "Unspecified workout";
      workouts.set(workout, (workouts.get(workout) ?? 0) + 1);
    }
  }
  result.rate = result.eligible
    ? (result.successful / result.eligible) * 100
    : null;
  result.latestRun = hasDailyGoals ? run : null;
  result.longestRun = hasDailyGoals ? longest : null;
  for (const [unit, values] of unitRows) {
    const observed = [...values.values()]
      .filter((r) => r.value !== null)
      .map((r) => r.value!);
    if (!observed.length) continue;
    const total = observed.reduce((a, b) => a + b, 0);
    result.quantities.push({
      unit,
      total,
      average: total / observed.length,
      days: source.map((d) => ({
        date: d.date,
        ...(values.get(d.date) ?? { value: null, target: null }),
      })),
    });
  }
  result.workouts = [...workouts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const byDate = new Map(source.map((d) => [d.date, d]));
  for (
    let date = weekStart(source[0]?.date ?? today);
    date <= (source.at(-1)?.date ?? "");
    date = addDays(date, 7)
  ) {
    const days = Array.from({ length: 7 }, (_, i) =>
      byDate.get(addDays(date, i)),
    );
    const cfg = days.find((d) => d?.config?.schedule === "weekly")?.config;
    if (!cfg) continue;
    // Do not guess quotas for partial weeks or settings changes within the week.
    const eligible =
      !archived &&
      addDays(date, 6) < today &&
      days.every(
        (d) => d?.config && JSON.stringify(d.config) === JSON.stringify(cfg),
      ) &&
      measurableGoal(cfg);
    const goalDays = days.filter(
      (d) =>
        d?.config &&
        d.date <= today &&
        habitOutcome(d.config, d.record) === "met",
    ).length;
    result.weeks.push({
      date,
      goalDays,
      target: cfg.timesPerWeek,
      eligible,
      met: eligible && goalDays >= cfg.timesPerWeek,
    });
  }
  return result;
}
