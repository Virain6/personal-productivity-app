import { Check, Circle, Minus, CircleAlert } from "lucide-react";
export type CalendarState =
  "success" | "neutral" | "warning" | "danger" | "rest";
export function calendarCardClass(state: CalendarState) {
  return `min-w-0 rounded-lg border p-2 ${state === "success" ? "border-success/50 bg-success/10" : state === "danger" ? "border-danger/50 bg-danger/10" : state === "warning" ? "border-warning/50 bg-surface" : "border-border bg-surface"}`;
}
export function CalendarStatusIcon({ state }: { state: CalendarState }) {
  if (state === "success")
    return (
      <span
        aria-hidden="true"
        className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-success text-background"
      >
        <Check size={14} strokeWidth={3} />
      </span>
    );
  const Icon =
    state === "warning" || state === "danger"
      ? CircleAlert
      : state === "rest"
        ? Minus
        : Circle;
  return (
    <Icon
      aria-hidden="true"
      size={20}
      className={
        state === "danger"
          ? "text-danger"
          : state === "warning"
            ? "text-warning"
            : "text-muted"
      }
    />
  );
}
