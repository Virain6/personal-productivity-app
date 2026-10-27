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
  const [editing, setEditing] = useState<Session | null>(null);
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
              {s.overlapConfirmed && (
                <p className="mt-2 text-warning">Intentional overlap</p>
              )}
              {s.endedAt !== null && (
                <Button
                  variant="ghost"
                  disabled={busy || editing !== null}
                  onClick={() => setEditing(s)}
                  aria-label={`Correct session ${DateTime.fromMillis(s.startedAt, { zone: timezone }).toFormat("MMM d, HH:mm")}`}
                >
                  Correct time
                </Button>
              )}
              {s.summary && <p className="mt-2 text-muted">{s.summary}</p>}
            </li>
          ))
        ) : (
          <li className="text-xs text-muted">
            No time recorded yet. A quick completion never invents logged time.
          </li>
        )}
      </ul>
      {editing && (
        <SessionCorrection
          key={editing.id}
          session={editing}
          timezone={timezone}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onSaved();
          }}
        />
      )}
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

function SessionCorrection({
  session,
  timezone,
  onCancel,
  onSaved,
}: {
  session: Session;
  timezone: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const originalLocal = DateTime.fromMillis(session.startedAt, {
    zone: timezone,
  }).toFormat("yyyy-MM-dd'T'HH:mm");
  const [start, setStart] = useState(originalLocal);
  const [offset, setOffset] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const options = localOptions(start, timezone);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const submitted = String(form.get("correctStart"));
      const candidates = localOptions(submitted, timezone);
      const startedAt =
        submitted === originalLocal
          ? session.startedAt
          : candidates.length === 1
            ? candidates[0]?.value
            : candidates.find((o) => String(o.value) === offset)?.value;
      if (startedAt === undefined)
        throw new Error(
          "Choose a valid local time and select its UTC offset if the clock repeats.",
        );
      await sendCommand({
        action: "correctSession",
        id: session.id,
        expected: {
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          summary: session.summary,
          overlapConfirmed: session.overlapConfirmed,
        },
        startedAt,
        endedAt:
          startedAt + Math.round(Number(form.get("correctMinutes")) * 60000),
        summary: String(form.get("correctSummary")),
        overlapConfirmed: form.get("correctOverlap") === "on",
      });
      onSaved();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not correct this session.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={save}
      className="mb-4 space-y-3 rounded-lg border border-border p-3"
      aria-label="Correct recorded time"
    >
      <h4 className="font-medium">Correct recorded time</h4>
      <p className="text-xs text-muted">
        Updates this saved session only. Completion stays unchanged. Unchanged
        start times preserve their exact seconds and UTC offset.
      </p>
      <label>
        Corrected start · {timezone}
        <input
          name="correctStart"
          type="datetime-local"
          required
          value={start}
          onChange={(e) => {
            setStart(e.target.value);
            setOffset("");
          }}
        />
      </label>
      {start !== originalLocal && options.length > 1 && (
        <label>
          Clock repeats — choose UTC offset
          <select
            required
            value={offset}
            onChange={(e) => setOffset(e.target.value)}
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
        Corrected minutes
        <input
          name="correctMinutes"
          type="number"
          step="any"
          min={0.0001}
          max={10080}
          defaultValue={(session.endedAt! - session.startedAt) / 60000}
          required
        />
      </label>
      <label>
        Corrected summary
        <textarea
          name="correctSummary"
          maxLength={500}
          defaultValue={session.summary}
        />
      </label>
      <label className="flex min-h-11 items-center gap-2">
        <input
          name="correctOverlap"
          type="checkbox"
          defaultChecked={session.overlapConfirmed}
        />
        Allow intentional overlap
      </label>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        Save correction
      </Button>
      <Button disabled={busy} variant="ghost" onClick={onCancel}>
        Cancel correction
      </Button>
    </form>
  );
}
