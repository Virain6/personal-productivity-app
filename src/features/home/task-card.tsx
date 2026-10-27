import { ArrowUpRight } from "lucide-react";
import { DateTime } from "luxon";
import type { Task } from "@/lib/planner-types";
import { formatDuration } from "@/lib/dates";
import {
  CalendarStatusIcon,
  calendarCardClass,
} from "@/components/calendar-status";
export function TaskCard({
  task,
  onOpen,
  onComplete,
  busy,
  children,
  timezone,
}: {
  task: Task;
  onOpen: () => void;
  onComplete: () => void;
  busy: boolean;
  children?: React.ReactNode;
  timezone: string;
}) {
  const color =
    task.category === "Project"
      ? "category-project"
      : task.category === "Applications"
        ? "category-jobs"
        : "category-learning";
  const state =
    task.status === "done"
      ? "success"
      : task.status === "skipped"
        ? "rest"
        : "neutral";
  const when =
    task.mode === "fixed"
      ? DateTime.fromMillis(task.fixedStart!, { zone: timezone }).toFormat(
          "HH:mm",
        ) +
        "–" +
        DateTime.fromMillis(task.fixedEnd!, { zone: timezone }).toFormat(
          "MMM d, HH:mm",
        )
      : task.suggestedTime
        ? `Suggested ${task.suggestedTime}`
        : "Anytime";
  return (
    <article className={calendarCardClass(state)} data-state={state}>
      <p
        className={`truncate text-[10px] font-medium uppercase tracking-wider ${color}`}
      >
        {task.category}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={onOpen}
          className="min-h-11 min-w-0 flex-1 break-words py-1 text-left text-[13px] font-medium leading-snug hover:text-accent-hover"
        >
          <span
            className={task.status === "done" ? "text-muted line-through" : ""}
          >
            {task.title}
          </span>
        </button>
        <button
          disabled={busy || task.status === "skipped"}
          onClick={onComplete}
          aria-label={`${task.status === "done" ? "Undo completion of" : "Complete"} ${task.title}`}
          className="flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-elevated disabled:opacity-40"
        >
          <CalendarStatusIcon state={state} />
        </button>
      </div>
      <p className="text-[11px] text-muted">
        {when}
        {task.optional ? " · Optional" : ""}
      </p>
      <div className="flex items-center justify-between gap-1">
        <div className="min-w-0 text-[11px] text-muted">
          <p className="numeric">
            {formatDuration(task.targetMinutes * 60000)} plan ·{" "}
            {formatDuration(task.actualMs)} logged
          </p>
          {task.status !== "pending" && (
            <p className={task.status === "done" ? "text-success" : ""}>
              {task.status === "done"
                ? "Completed"
                : task.status === "skipped"
                  ? "Skipped"
                  : "In progress"}
            </p>
          )}
        </div>
        {children ?? (
          <button
            className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted hover:bg-elevated"
            aria-label={`Details for ${task.title}`}
            onClick={onOpen}
          >
            <ArrowUpRight size={16} />
          </button>
        )}
      </div>
      {task.occurrenceDate && task.occurrenceDate !== task.plannedDate && (
        <p className="text-[10px] text-muted">
          Moved from {task.occurrenceDate}
        </p>
      )}
    </article>
  );
}
