import { Circle, CheckCircle2, ArrowUpRight, Clock3 } from "lucide-react";
import { DateTime } from "luxon";
import type { Task } from "@/lib/planner-types";
import { formatDuration } from "@/lib/dates";
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
  return (
    <article
      className={`min-w-0 rounded-lg border border-border bg-surface p-2.5 ${task.status === "skipped" ? "opacity-60" : ""}`}
    >
      <div className="flex items-center justify-between gap-1">
        <span
          className={`truncate text-[10px] font-medium uppercase tracking-wider ${color}`}
        >
          {task.category}
        </span>
        <button
          disabled={busy || task.status === "skipped"}
          onClick={onComplete}
          aria-label={`${task.status === "done" ? "Undo completion of" : "Complete"} ${task.title}`}
          className={`-mr-1 flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-elevated ${task.status === "done" ? "text-success" : "text-muted"}`}
        >
          {task.status === "done" ? (
            <CheckCircle2 size={18} />
          ) : (
            <Circle size={18} />
          )}
        </button>
      </div>
      <button
        onClick={onOpen}
        className="min-h-11 w-full text-left text-[13px] font-medium leading-snug hover:text-accent-hover"
      >
        <span
          className={task.status === "done" ? "text-muted line-through" : ""}
        >
          {task.title}
        </span>
      </button>
      <div className="mt-2 flex items-center gap-1 text-[11px] text-muted">
        <Clock3 size={12} />
        <span>
          {task.mode === "fixed"
            ? DateTime.fromMillis(task.fixedStart!, {
                zone: timezone,
              }).toFormat("HH:mm")
            : task.suggestedTime
              ? `Suggested ${task.suggestedTime}`
              : "Anytime"}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
        <span className="numeric">
          {formatDuration(task.targetMinutes * 60000)} planned
        </span>
        {task.optional && <span>Optional</span>}
        {task.status === "skipped" && <span>Skipped</span>}
        {task.status === "done" && <span className="text-success">Done</span>}
      </div>
      {task.occurrenceDate && task.occurrenceDate !== task.plannedDate && (
        <p className="mt-2 text-[10px] text-muted">
          Moved from {task.occurrenceDate}
        </p>
      )}
      <div className="mt-2 flex items-center justify-between border-t border-border pt-1">
        <span className="numeric text-[11px] text-muted">
          {formatDuration(task.actualMs)} recorded
        </span>
        {children ?? (
          <button
            className="flex size-11 items-center justify-center rounded-lg text-muted hover:bg-elevated"
            aria-label={`Details for ${task.title}`}
            onClick={onOpen}
          >
            <ArrowUpRight size={16} />
          </button>
        )}
      </div>
    </article>
  );
}
