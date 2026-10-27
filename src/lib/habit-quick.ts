import {
  habitDirection,
  type HabitRecord,
  type HabitView,
} from "./habit-types";
export type HabitQuickMode = "toggle" | "zero" | "increment" | "decrement";
export function habitQuickStep(h: HabitView) {
  const c = h.dateConfig;
  if (c?.kind !== "quantity") return null;
  // Step is a UI convenience, not a historical goal. Never cross units/types.
  return (
    (h.config.kind === c.kind && h.config.unit === c.unit
      ? h.config.quickStep
      : c.quickStep) ?? null
  );
}
type QuickRecord = {
  state: HabitRecord["state"];
  quantity: number | null;
  workout: string;
  advance: boolean;
};
// Shared decision logic; the service re-evaluates it against authoritative rows
// inside the existing immediate transaction before using ordinary record writes.
export function quickHabitRecord(
  h: HabitView,
  date: string,
  today: string,
  mode: HabitQuickMode,
): QuickRecord | null {
  const c = h.dateConfig,
    r = h.record;
  if (!c || date > today || date < h.createdDate || (h.archived && !r))
    return null;
  const base: QuickRecord = {
    state: "done",
    quantity: null,
    workout: "",
    advance: false,
  };
  if (mode === "zero")
    return c.kind === "quantity" && habitDirection(c) !== "build"
      ? { ...base, quantity: 0 }
      : null;
  if (mode === "increment" || mode === "decrement") {
    const step = habitQuickStep(h);
    if (
      c.kind !== "quantity" ||
      !step ||
      r?.state !== "done" ||
      r.quantityMilli === null
    )
      return null;
    const total =
      r.quantityMilli +
      (mode === "increment" ? 1 : -1) * Math.round(step * 1000);
    return total < 0 || total > 1_000_000_000_000
      ? null
      : { ...base, quantity: total / 1000 };
  }
  if (c.kind === "binary")
    return {
      ...base,
      state:
        habitDirection(c) === "build"
          ? r?.state === "done"
            ? "notDone"
            : "done"
          : r?.state === "notDone"
            ? "unlogged"
            : "notDone",
    };
  if (c.kind !== "workout") return null;
  if (r?.state === "done") {
    if (r.advancedFrom !== null && r.advanceCursor !== h.cursorVersion)
      return null;
    return { ...base, state: "notDone" };
  }
  // Historical/changed settings and rest require an explicit actual-workout choice.
  const planned = h.config.rotation[h.nextIndex]?.trim();
  if (
    habitDirection(c) !== "build" ||
    date !== today ||
    h.revisionId !== h.currentRevisionId ||
    !planned ||
    planned.toLowerCase() === "rest" ||
    (h.nextDate && h.nextDate > today)
  )
    return null;
  return { ...base, workout: planned, advance: true };
}
