import { formatDuration } from "@/lib/dates";
import type { HomeData } from "@/lib/planner-types";

export function DailyProgress({
  stats,
}: {
  stats?: HomeData["metrics"]["days"][number];
}) {
  const {
    done = 0,
    required = 0,
    trackedMs = 0,
    plannedMinutes = 0,
  } = stats ?? {};
  const percent = required ? Math.min(100, (done / required) * 100) : 0;
  const timePercent =
    plannedMinutes > 0
      ? Math.min(100, (trackedMs / (plannedMinutes * 60000)) * 100)
      : 0;
  const timeLabel = `${formatDuration(trackedMs)} / ${formatDuration(plannedMinutes * 60000)}`;
  return (
    <div className="mb-2 space-y-2">
      <div
        role="progressbar"
        aria-label="Task completion"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={
          required
            ? `${done} of ${required} required tasks completed`
            : "No required tasks"
        }
        className="grid grid-cols-4 gap-1"
      >
        {[0, 1, 2, 3].map((segment) => (
          <span
            key={segment}
            aria-hidden="true"
            className="h-1 overflow-hidden rounded-full bg-elevated"
          >
            <span
              className="block h-full rounded-full bg-success"
              style={{
                width: `${Math.max(0, Math.min(100, (percent - segment * 25) * 4))}%`,
              }}
            />
          </span>
        ))}
      </div>
      <div>
        <p
          className="numeric mb-1 text-[11px] text-muted"
          aria-label={`Recorded / planned time: ${timeLabel}`}
        >
          {timeLabel}
        </p>
        <div
          role="progressbar"
          aria-label="Recorded time versus planned time"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={timePercent}
          aria-valuetext={`${timeLabel} recorded / planned`}
          className="h-1 overflow-hidden rounded-full bg-elevated"
        >
          <span
            className="block h-full rounded-full bg-accent"
            style={{ width: `${timePercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
