"use client";
import { useRef, useState, type FormEvent } from "react";
import { DateTime } from "luxon";
import type { Task } from "@/lib/planner-types";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { sendCommand } from "@/lib/api";
export function MoveDialog({
  task,
  timezone,
  onClose,
  onSaved,
}: {
  task: Task;
  timezone: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const gate = useRef(false);
  const [dirty, setDirty] = useState(false),
    [discard, setDiscard] = useState(false);
  function close() {
    if (!busy) {
      if (dirty) setDiscard(true);
      else onClose();
    }
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (gate.current) return;
    gate.current = true;
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      await sendCommand({
        action: "moveTask",
        id: task.id,
        version: task.version,
        date: String(f.get("date")),
        time: String(f.get("time")) || null,
      });
      onSaved(`Moved “${task.title}” to ${f.get("date")}.`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not move activity.");
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  return (
    <Dialog
      layout="calendar"
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title="Move to Date"
      description="Move this occurrence only. The recurring schedule, status and recorded time remain unchanged."
    >
      {discard && (
        <div role="alert" className="mb-3 rounded-lg border border-border p-3">
          <p>Discard this unsaved move?</p>
          <Button onClick={() => setDiscard(false)}>Keep editing</Button>
          <Button variant="danger" onClick={onClose}>
            Discard
          </Button>
        </div>
      )}
      <form
        onChange={() => setDirty(true)}
        onSubmit={save}
        className="space-y-3"
      >
        <fieldset disabled={busy} className="space-y-3">
          <p className="font-medium">{task.title}</p>
          <label>
            New date
            <input
              type="date"
              name="date"
              required
              defaultValue={task.plannedDate}
            />
          </label>
          <label>
            {task.mode === "fixed"
              ? "Event start"
              : "Suggested start · optional"}
            <input
              type="time"
              name="time"
              required={task.mode === "fixed"}
              defaultValue={
                task.mode === "fixed"
                  ? DateTime.fromMillis(task.fixedStart!, {
                      zone: timezone,
                    }).toFormat("HH:mm")
                  : (task.suggestedTime ?? "")
              }
            />
          </label>
          <p className="text-xs text-muted">
            {task.mode === "fixed" ? "The event duration is preserved. " : ""}
            {task.status === "done" || task.status === "skipped"
              ? "This is a historical activity; moving it changes which day reports its status. Saved study time keeps its original dates."
              : "Any running timer continues on this same activity."}
          </p>
          <div className="flex justify-end gap-2">
            <Button onClick={close}>Cancel</Button>
            <Button type="submit" variant="primary">
              {busy ? "Moving…" : "Confirm move"}
            </Button>
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}
