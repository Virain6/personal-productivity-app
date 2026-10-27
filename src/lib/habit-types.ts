export type HabitDirection = "build" | "limit" | "avoid";
export type HabitKind = "binary" | "quantity" | "workout";
export type HabitConfig = {
  name: string;
  kind: HabitKind;
  unit: string;
  // Optional only for pre-Phase-3 JSON revisions. New writes always store direction.
  direction?: HabitDirection;
  goal: "awareness" | "atLeast" | "atMost";
  target: number | null;
  schedule: "daily" | "weekdays" | "weekly";
  weekdays: number[];
  timesPerWeek: number;
  rotation: string[];
};
export type HabitRecord = {
  id: string;
  habitId: string;
  date: string;
  revisionId: string;
  version: number;
  state: "unlogged" | "done" | "notDone" | "rest";
  quantityMilli: number | null;
  workout: string;
  plannedWorkout: string;
  advancedFrom: number | null;
  advanceCursor: number | null;
  updatedAt: number;
};
export type HabitView = {
  id: string;
  version: number;
  archived: boolean;
  createdDate: string;
  config: HabitConfig;
  dateConfig: HabitConfig | null;
  revisionId: string | null;
  nextIndex: number;
  nextDate: string | null;
  cursorVersion: number;
  record: HabitRecord | null;
  expected: boolean;
  weekLogged: number;
  weekSummary: ReturnType<typeof summarizeHabitDays>;
};
export type HabitsData = {
  date: string;
  today: string;
  timezone: string;
  habits: HabitView[];
  history: (HabitRecord & { config: HabitConfig })[];
};
// Read-time compatibility keeps immutable historical JSON untouched.
export function habitDirection(config: HabitConfig): HabitDirection {
  return (
    config.direction ??
    (config.kind === "quantity" && config.goal === "atMost" ? "limit" : "build")
  );
}
export type HabitOutcome =
  "unlogged" | "rest" | "recorded" | "met" | "below" | "exceeded";
export function habitOutcome(
  config: HabitConfig,
  record: HabitRecord | null,
): HabitOutcome {
  if (!record || record.state === "unlogged") return "unlogged";
  if (record.state === "rest") return "rest";
  const direction = habitDirection(config);
  // An absent/invalid quantity must never become an implicit zero.
  if (config.kind === "quantity" && record.quantityMilli === null)
    return "unlogged";
  const value =
    config.kind === "quantity"
      ? record.quantityMilli!
      : record.state === "done"
        ? 1000
        : 0;
  if (direction === "avoid") return value === 0 ? "met" : "exceeded";
  if (direction === "limit")
    return value <= Math.round((config.target ?? 0) * 1000)
      ? "met"
      : "exceeded";
  if (
    config.kind === "quantity" &&
    (config.goal === "awareness" || config.target === null)
  )
    return "recorded";
  const target =
    config.kind === "quantity" ? Math.round(config.target! * 1000) : 1000;
  return value >= target ? "met" : "below";
}
export function habitGoalLabel(config: HabitConfig) {
  const direction = habitDirection(config);
  if (direction === "avoid") return "Avoid · goal is zero";
  if (direction === "limit")
    return `Limit · at most ${config.target} ${config.kind === "quantity" ? config.unit : "occurrence per day"}`;
  if (config.kind !== "quantity") return "Build / maintain";
  return config.goal === "awareness" || config.target === null
    ? "Build / maintain · awareness only"
    : `Build / maintain · at least ${config.target} ${config.unit}`;
}
export function habitResult(config: HabitConfig, record: HabitRecord | null) {
  const outcome = habitOutcome(config, record);
  if (outcome === "unlogged") return "Not logged";
  if (outcome === "rest") return "Rest · not a missed workout";
  const direction = habitDirection(config);
  const label =
    outcome === "met"
      ? direction === "limit"
        ? "Within limit"
        : "Goal met"
      : outcome === "exceeded"
        ? "Exceeded limit"
        : "Below target";
  if (config.kind !== "quantity") return label;
  const value = `${record!.quantityMilli! / 1000} ${config.unit}`;
  return outcome === "recorded" ? `${value} recorded` : `${value} · ${label}`;
}
export type HabitDay = {
  date: string;
  config: HabitConfig | null;
  record: HabitRecord | null;
  expected: boolean;
};
// Observation counts, not an adherence percentage. Flexible weekly habits have no
// invented daily quota; voluntarily logged days are included and rest stays separate.
export function summarizeHabitDays(days: HabitDay[], today: string) {
  const result = {
    loggedDays: 0,
    goalDays: 0,
    exceededDays: 0,
    restDays: 0,
    unloggedDays: 0,
  };
  for (const day of days) {
    if (!day.config || day.date > today) continue;
    const outcome = habitOutcome(day.config, day.record);
    if (outcome === "unlogged") {
      if (day.expected) result.unloggedDays++;
      continue;
    }
    if (outcome === "rest") {
      result.restDays++;
      continue;
    }
    result.loggedDays++;
    if (outcome === "met") result.goalDays++;
    if (outcome === "exceeded") result.exceededDays++;
  }
  return result;
}

export type HabitCalendarData = {
  from: string;
  to: string;
  today: string;
  timezone: string;
  days: { date: string; habits: HabitView[] }[];
};
export function homeHabits(data: HabitsData) {
  return data.habits.filter((h) => {
    if (!h.dateConfig) return false;
    const recorded = !!h.record && h.record.state !== "unlogged";
    // Keep real history visible, including voluntary and archived entries.
    if (recorded) return data.date <= data.today;
    if (h.archived) return false;
    // An explicit workout date overrides its general schedule for future planning.
    if (
      h.dateConfig.kind === "workout" &&
      h.nextDate &&
      data.date >= data.today
    )
      return h.nextDate === data.date;
    return h.expected || h.dateConfig.schedule === "weekly";
  });
}
export function plannedWorkout(h: HabitView, date: string, today: string) {
  if (h.record?.plannedWorkout) return h.record.plannedWorkout;
  if (date < today || h.dateConfig?.kind !== "workout") return "";
  return h.config.rotation[h.nextIndex] ?? "";
}
