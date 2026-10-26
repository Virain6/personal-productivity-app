"use client";
import { useState, type FormEvent, type ReactNode } from "react";
import { DateTime } from "luxon";
import { categories, type Task } from "@/lib/planner-types";
import { formatDuration, localOptions } from "@/lib/dates";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { sendCommand } from "@/lib/api";
export function TaskDialog({
  task,
  date,
  timezone,
  onClose,
  children,
}: {
  task: Task | null;
  date: string;
  timezone: string;
  onClose: () => void;
  children?: ReactNode;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState(task?.mode ?? "flexible");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(event.currentTarget);
    try {
      const start =
        mode === "fixed"
          ? localOptions(String(f.get("fixedStart")), timezone)
          : [];
      const end =
        mode === "fixed"
          ? localOptions(String(f.get("fixedEnd")), timezone)
          : [];
      if (mode === "fixed" && (start.length !== 1 || end.length !== 1))
        throw new Error(
          "Choose unambiguous valid local event times. Daylight-saving repeated/missing times are not supported for fixed events yet.",
        );
      const fields = {
        title: String(f.get("title")),
        category: String(f.get("category")),
        plannedDate: String(f.get("date")),
        mode,
        suggestedTime:
          mode === "flexible" ? String(f.get("time")) || null : null,
        targetMinutes: Number(f.get("duration")),
        fixedStart: start[0]?.value ?? null,
        fixedEnd: end[0]?.value ?? null,
        optional: f.get("optional") === "on",
        summary: String(f.get("summary")),
      };
      await sendCommand(
        task
          ? { action: "edit", id: task.id, version: task.version, fields }
          : { action: "create", fields },
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }
  async function status(value: "pending" | "skipped") {
    setBusy(true);
    setError("");
    try {
      await sendCommand({
        action: "status",
        id: task!.id,
        version: task!.version,
        status: value,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      title={task ? "Activity details" : "Add an activity"}
      description={
        task
          ? "Changes apply only to this occurrence. Your weekly routine stays the same."
          : "Make space for something you want to do."
      }
    >
      <form onSubmit={save} className="space-y-4">
        <label>
          Activity
          <input
            name="title"
            defaultValue={task?.title ?? ""}
            required
            maxLength={160}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label>
            Category
            <select name="category" defaultValue={task?.category ?? "Other"}>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Date
            <input
              type="date"
              name="date"
              required
              defaultValue={task?.plannedDate ?? date}
            />
          </label>
        </div>
        <label>
          Schedule
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as "flexible" | "fixed")}
          >
            <option value="flexible">Flexible · any time works</option>
            <option value="fixed">Fixed event</option>
          </select>
        </label>
        {mode === "fixed" ? (
          <div className="grid gap-3">
            <label>
              Start · {timezone}
              <input
                type="datetime-local"
                name="fixedStart"
                required
                defaultValue={
                  task?.fixedStart
                    ? DateTime.fromMillis(task.fixedStart, {
                        zone: timezone,
                      }).toFormat("yyyy-MM-dd'T'HH:mm")
                    : undefined
                }
              />
            </label>
            <label>
              End · {timezone}
              <input
                type="datetime-local"
                name="fixedEnd"
                required
                defaultValue={
                  task?.fixedEnd
                    ? DateTime.fromMillis(task.fixedEnd, {
                        zone: timezone,
                      }).toFormat("yyyy-MM-dd'T'HH:mm")
                    : undefined
                }
              />
            </label>
          </div>
        ) : (
          <label>
            Suggested start · optional
            <input
              type="time"
              name="time"
              defaultValue={task?.suggestedTime ?? ""}
            />
          </label>
        )}
        <label>
          {mode === "fixed"
            ? "Target minutes (recalculated from event times)"
            : "Target minutes"}
          <input
            type="number"
            name="duration"
            min={1}
            max={1440}
            required
            defaultValue={task?.targetMinutes ?? 60}
          />
        </label>
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            name="optional"
            defaultChecked={task?.optional ?? false}
          />
          Optional · excluded from required completion
        </label>
        <label>
          What did you work on? <span className="text-muted">(optional)</span>
          <textarea
            name="summary"
            rows={3}
            maxLength={500}
            defaultValue={task?.summary ?? ""}
          />
        </label>
        {task && (
          <p className="text-xs text-muted">
            Status: {task.status.replace("_", " ")} · Recorded:{" "}
            <span className="numeric">{formatDuration(task.actualMs)}</span>
          </p>
        )}
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          {task && (
            <Button
              disabled={busy}
              variant="ghost"
              onClick={() =>
                status(task.status === "skipped" ? "pending" : "skipped")
              }
            >
              {task.status === "skipped"
                ? "Restore activity"
                : "Skip occurrence"}
            </Button>
          )}
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Saving…" : "Save activity"}
          </Button>
        </div>
      </form>
      {children && (
        <div className="mt-6 border-t border-border pt-5">{children}</div>
      )}
    </Dialog>
  );
}
