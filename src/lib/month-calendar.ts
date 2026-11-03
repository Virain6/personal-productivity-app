import { DateTime } from "luxon";
import { addDays, weekStart } from "./dates";
import type { Task } from "./planner-types";
import { roadmapColor } from "./roadmap-colors";
export type CalendarView = "day" | "week" | "month";
export function monthGrid(date: string) {
  const month = DateTime.fromISO(date, { zone: "UTC" });
  const first = month.startOf("month").toISODate()!;
  const last = month.endOf("month").toISODate()!;
  const from = weekStart(first),
    to = addDays(weekStart(last), 6);
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return { from, to, days, month: first.slice(0, 7) };
}
export function calendarRange(date: string, view: CalendarView) {
  if (view === "month") {
    const { from, to } = monthGrid(date);
    return { from, to };
  }
  const from = weekStart(date);
  return { from, to: addDays(from, 6) };
}
export function moveCalendar(
  date: string,
  view: CalendarView,
  direction: number,
) {
  return view === "month"
    ? DateTime.fromISO(date, { zone: "UTC" })
        .plus({ months: direction })
        .toISODate()!
    : addDays(date, direction * (view === "week" ? 7 : 1));
}
export function monthTaskStatus(task: Task, today: string) {
  if (task.status === "done") return "Completed";
  if (task.status === "skipped") return "Skipped";
  if (task.plannedDate < today && !task.optional) return "Unfinished past";
  return task.status === "in_progress" ? "In progress" : "Scheduled";
}
export function monthTaskColor(task: Task) {
  return task.studyRoadmap
    ? roadmapColor(task.studyRoadmap.color)
    : "var(--muted)";
}
