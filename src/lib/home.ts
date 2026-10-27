import { DateTime } from "luxon";
import type { Task } from "./planner-types";
export function compareAgenda(a: Task, b: Task, timezone: string) {
  const time = (t: Task) =>
    t.mode === "fixed" && t.fixedStart !== null
      ? DateTime.fromMillis(t.fixedStart, { zone: timezone }).toFormat("HH:mm")
      : (t.suggestedTime ?? "99");
  return (
    Number(a.status === "done" || a.status === "skipped") -
      Number(b.status === "done" || b.status === "skipped") ||
    time(a).localeCompare(time(b)) ||
    a.category.localeCompare(b.category) ||
    a.id.localeCompare(b.id)
  );
}
export function completionLabel(done: number, required: number) {
  return required
    ? `${done}/${required} required · ${Math.round((done / required) * 100)}%`
    : "No required activities";
}
