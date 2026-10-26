"use client";
import { useState, type FormEvent } from "react";
import { DateTime } from "luxon";
import type { Session, Task } from "@/lib/planner-types";
import { localOptions, formatDuration } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { sendCommand } from "@/lib/api";
import { TaskTimer } from "./task-timer";
export function SessionLog({
  task,
  sessions,
  timezone,
  onSaved,
}: {
  task: Task;
  sessions: Session[];
  timezone: string;
  onSaved: () => void;
}) {
  const [start, setStart] = useState("");
  const [offset, setOffset] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const options = localOptions(start, timezone);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setError("");
    try {
      const submittedOptions = localOptions(
        String(f.get("startedAt")),
        timezone,
      );
      const selected =
        submittedOptions.length === 1
          ? submittedOptions[0]
          : submittedOptions.find((o) => String(o.value) === offset);
      if (!selected)
        throw new Error(
          "Choose a valid local time and select its UTC offset if the clock repeats.",
        );
      const duration = Number(f.get("minutes"));
      await sendCommand({
        action: "manual",
        id: task.id,
        startedAt: selected.value,
        endedAt: selected.value + duration * 60000,
        summary: String(f.get("sessionSummary")),
        overlapConfirmed: f.get("overlap") === "on",
      });
      setStart("");
      setOffset("");
      form.reset();
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save time.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Time sessions">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Time sessions</h3>
        <TaskTimer task={task} />
      </div>
      <ul className="mb-4 space-y-2">
        {sessions.length ? (
          sessions.map((s) => (
            <li key={s.id} className="rounded-lg bg-background p-3 text-xs">
              <div className="flex justify-between gap-3">
                <span>
                  {DateTime.fromMillis(s.startedAt, {
                    zone: timezone,
                  }).toFormat("MMM d, HH:mm ZZ")}
                </span>
                <span className="numeric text-muted">
                  {s.endedAt
                    ? formatDuration(s.endedAt - s.startedAt)
                    : "Running"}{" "}
                  · {s.source}
                </span>
              </div>
              {s.summary && <p className="mt-2 text-muted">{s.summary}</p>}
            </li>
          ))
        ) : (
          <li className="text-xs text-muted">
            No time recorded yet. A quick completion never invents logged time.
          </li>
        )}
      </ul>
      <details>
        <summary className="min-h-11 cursor-pointer py-3 text-sm text-accent-hover">
          Add time manually
        </summary>
        <form onSubmit={save} className="space-y-3">
          <label>
            Started · {timezone}
            <input
              name="startedAt"
              type="datetime-local"
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
                setOffset("");
              }}
              required
            />
          </label>
          {options.length > 1 && (
            <label>
              Clock repeats — choose UTC offset
              <select
                value={offset}
                onChange={(e) => setOffset(e.target.value)}
                required
              >
                <option value="">Choose offset</option>
                {options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Minutes
            <input type="number" name="minutes" min={1} max={10080} required />
          </label>
          <label>
            Session summary
            <textarea name="sessionSummary" maxLength={500} rows={2} />
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" name="overlap" />
            Allow intentional overlap (totals may exceed elapsed time)
          </label>
          {error && (
            <p role="alert" className="text-danger">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            Save time
          </Button>
        </form>
      </details>
    </section>
  );
}
