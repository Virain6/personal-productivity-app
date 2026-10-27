import { Leaf } from "lucide-react";
import { habitResult, plannedWorkout, type HabitView } from "@/lib/habit-types";
export function CalendarHabit({
  habit: h,
  date,
  today,
  onOpen,
}: {
  habit: HabitView;
  date: string;
  today: string;
  onOpen: () => void;
}) {
  const c = h.dateConfig!;
  const planned = plannedWorkout(h, date, today);
  return (
    <article className="min-w-0 rounded-lg border border-border bg-surface p-2.5">
      <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-success">
        <Leaf size={12} aria-hidden="true" />
        Habit{h.archived ? " · Archived" : ""}
      </div>
      <button
        onClick={onOpen}
        aria-label={`Log ${c.name} for ${date}`}
        className="min-h-11 w-full break-words text-left text-[13px] font-medium leading-snug hover:text-accent-hover"
      >
        {c.name}
      </button>
      <p className="text-[11px] text-muted">{habitResult(c, h.record)}</p>
      {planned && (
        <p className="mt-2 text-[11px] text-muted">
          {h.record ? "Planned" : "Next"}: {planned}
          {planned.toLowerCase() === "rest" ? " · rest is neutral" : ""}
        </p>
      )}
      {c.schedule === "weekly" && (
        <p className="mt-2 text-[11px] text-muted">
          Flexible · {c.timesPerWeek} days / week
        </p>
      )}
      {date > today && (
        <p className="mt-2 text-[11px] text-muted">
          Future · logging opens on the day
        </p>
      )}
    </article>
  );
}
