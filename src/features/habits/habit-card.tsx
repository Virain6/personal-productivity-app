"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { sendCommand } from "@/lib/api";
import {
  habitResult,
  habitDirection,
  habitGoalLabel,
  type HabitView,
} from "@/lib/habit-types";
export function HabitCard({
  habit: h,
  date,
  today,
  onEdit,
  compact = false,
}: {
  habit: HabitView;
  date: string;
  today: string;
  onEdit?: () => void;
  compact?: boolean;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const c = h.dateConfig;
  const r = h.record;
  async function act(command: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      await sendCommand(command);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }
  async function record(
    state: "done" | "notDone" | "rest" | "unlogged",
    quantity: number | null = null,
    workout = "",
    advance = false,
  ) {
    await act({
      action: "habitRecord",
      id: h.id,
      version: h.version,
      date,
      revisionId: h.revisionId,
      entryVersion: r?.version ?? 0,
      state,
      quantity,
      workout,
      advance,
    });
  }
  const disabled = busy || !c || date > today || (h.archived && !r);
  const planned = h.config.rotation[h.nextIndex] ?? "";
  function plan(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void act({
      action: "habitNext",
      id: h.id,
      version: h.version,
      nextIndex: Number(f.get("nextIndex")),
      nextDate: String(f.get("nextDate")) || null,
    });
  }
  return (
    <article className="min-w-0 break-words rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="break-words text-base font-medium">{h.config.name}</h2>
          <p className="mt-1 text-xs capitalize text-muted">
            {h.config.kind}
            {h.archived ? " · Archived" : ""}
          </p>
        </div>
        {onEdit && (
          <Button variant="ghost" onClick={onEdit} disabled={busy}>
            Edit {h.config.name}
          </Button>
        )}
      </div>
      <p className="my-3 text-sm text-accent-hover">
        {c ? habitResult(c, r) : "Not yet active on this date"}
      </p>
      {c && (
        <p className="mb-3 text-xs text-muted">
          {c.schedule === "weekly"
            ? `${h.weekLogged} days logged · ${h.weekSummary.goalDays} goal days this week · aim ${c.timesPerWeek} on any days`
            : h.expected
              ? "Scheduled for this day"
              : "Unscheduled · optional to record"}
          {` · ${habitGoalLabel(c)}`}
        </p>
      )}
      {c && c.kind !== h.config.kind && (
        <p className="mb-3 text-xs text-warning">
          This date keeps its original {c.kind} settings.
        </p>
      )}
      {c?.kind === "binary" && (
        <div className="flex flex-wrap gap-2">
          {habitDirection(c) !== "build" ? (
            <>
              <Button
                disabled={disabled}
                aria-pressed={r?.state === "notDone"}
                onClick={() => void record("notDone")}
              >
                Did not do
              </Button>
              <Button
                disabled={disabled}
                aria-pressed={r?.state === "done"}
                onClick={() => void record("done")}
              >
                Did activity
              </Button>
              <p className="w-full text-xs text-muted">
                Record whether the named activity happened. Clear removes the
                day’s observation.
              </p>
            </>
          ) : (
            <Button
              disabled={disabled}
              variant={r?.state === "done" ? "secondary" : "primary"}
              onClick={() =>
                void record(r?.state === "done" ? "notDone" : "done")
              }
            >
              {r?.state === "done" ? "Undo completion" : "Mark complete"}
            </Button>
          )}
        </div>
      )}
      {c?.kind === "quantity" && (
        <form
          key={`${date}:${r?.version ?? 0}:${h.revisionId}`}
          onSubmit={(e) => {
            e.preventDefault();
            void record(
              "done",
              Number(new FormData(e.currentTarget).get("quantity")),
            );
          }}
          className="flex flex-wrap items-end gap-2"
        >
          <label className="min-w-0 flex-1">
            Daily total · {c.unit}
            <input
              name="quantity"
              type="number"
              min={0}
              max={1000000000}
              step="0.001"
              required
              defaultValue={
                r?.quantityMilli !== null && r?.quantityMilli !== undefined
                  ? r.quantityMilli / 1000
                  : ""
              }
              disabled={disabled}
            />
          </label>
          <Button type="submit" disabled={disabled}>
            Save total
          </Button>
          <p className="w-full text-xs text-muted">
            Replaces this date’s total. Zero means recorded zero; clear means
            not logged.
          </p>
        </form>
      )}
      {c?.kind === "workout" && (
        <form
          key={`${date}:${r?.version ?? 0}:${h.revisionId}`}
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void record(
              "done",
              null,
              String(f.get("workout")),
              f.get("advance") === "on",
            );
          }}
          className="space-y-3"
        >
          <p className="text-xs text-muted">
            Next planned: {planned}
            {h.nextDate ? ` · ${h.nextDate}` : " · whenever you’re ready"}
            {planned.toLowerCase() === "rest"
              ? " · Rest is not a missed workout"
              : ""}
          </p>
          {r?.plannedWorkout && (
            <p className="text-xs text-muted">
              Planned when recorded: {r.plannedWorkout}
            </p>
          )}
          <label>
            Actual workout
            <input
              name="workout"
              list={`workouts-${h.id}`}
              required
              maxLength={60}
              defaultValue={r?.workout ?? ""}
              placeholder="Select or enter workout"
              disabled={disabled}
            />
            <datalist id={`workouts-${h.id}`}>
              {Array.from(
                new Set(
                  [
                    ...c.rotation,
                    "Push",
                    "Pull",
                    "Legs",
                    "Cardio",
                    "Full Body",
                  ].filter((x) => x.toLowerCase() !== "rest"),
                ),
              ).map((x) => (
                <option key={x} value={x} />
              ))}
            </datalist>
          </label>
          {date === today && r?.state !== "done" && (
            <label className="flex min-h-11 items-center gap-2">
              <input name="advance" type="checkbox" disabled={disabled} />
              Also advance from the planned step
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={disabled}>
              Save workout
            </Button>
            <Button disabled={disabled} onClick={() => void record("rest")}>
              Record rest
            </Button>
            {(r?.state === "done" || habitDirection(c) !== "build") && (
              <Button
                disabled={disabled}
                onClick={() => void record("notDone")}
              >
                {habitDirection(c) === "build"
                  ? "Undo workout"
                  : "Record no workout"}
              </Button>
            )}
          </div>
        </form>
      )}
      {r && r.state !== "unlogged" && (
        <Button
          className="mt-3"
          variant="ghost"
          disabled={busy}
          onClick={() => void record("unlogged")}
        >
          Clear daily record
        </Button>
      )}
      {!compact && h.config.kind === "workout" && !h.archived && (
        <details className="mt-4 border-t border-border pt-2">
          <summary className="min-h-11 cursor-pointer py-3 text-sm">
            Plan next workout
          </summary>
          <form
            onSubmit={plan}
            key={`${h.nextIndex}:${h.nextDate}:${h.cursorVersion}`}
            className="space-y-3"
          >
            <label>
              Next step
              <select name="nextIndex" defaultValue={h.nextIndex}>
                {h.config.rotation.map((x, i) => (
                  <option key={i} value={i}>
                    {i + 1}. {x}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Planned date · optional
              <input
                type="date"
                name="nextDate"
                min={today}
                defaultValue={h.nextDate ?? ""}
              />
            </label>
            <p className="text-xs text-muted">
              Move or select the next step without changing past workouts. A
              blank date is flexible.
            </p>
            <Button type="submit" disabled={busy}>
              Save next workout
            </Button>
          </form>
        </details>
      )}
      {!compact && (
        <div className="mt-4 border-t border-border pt-2">
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() =>
              void act({
                action: "habitArchive",
                id: h.id,
                version: h.version,
                archived: !h.archived,
              })
            }
          >
            {h.archived ? "Restore habit" : "Archive habit"}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </article>
  );
}
