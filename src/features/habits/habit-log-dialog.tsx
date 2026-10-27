"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { sendCommand } from "@/lib/api";
import {
  habitDirection,
  habitGoalLabel,
  habitResult,
  plannedWorkout,
  type HabitRecord,
  type HabitView,
} from "@/lib/habit-types";
export function HabitLogDialog({
  habit: h,
  date,
  today,
  onClose,
  onSaved,
}: {
  habit: HabitView;
  date: string;
  today: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const c = h.dateConfig!;
  const r = h.record;
  const initialState = r?.state ?? "unlogged";
  const initialQuantity =
    r?.quantityMilli == null ? "" : String(r.quantityMilli / 1000);
  const [state, setState] = useState<HabitRecord["state"]>(initialState);
  const [quantity, setQuantity] = useState(initialQuantity);
  const [workout, setWorkout] = useState(r?.workout ?? "");
  const [advance, setAdvance] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [discard, setDiscard] = useState(false);
  const dirty =
    state !== initialState ||
    quantity !== initialQuantity ||
    workout !== (r?.workout ?? "") ||
    advance;
  const disabled = busy || date > today || (h.archived && !r);
  const planned = plannedWorkout(h, date, today);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function close() {
    if (busy) return;
    if (dirty) setDiscard(true);
    else onClose();
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (disabled) return;
    if (!dirty) {
      onClose();
      return;
    }
    setBusy(true);
    setError("");
    try {
      await sendCommand({
        action: "habitRecord",
        id: h.id,
        version: h.version,
        date,
        revisionId: h.revisionId,
        entryVersion: r?.version ?? 0,
        state,
        quantity:
          c.kind === "quantity" && state === "done" ? Number(quantity) : null,
        workout: c.kind === "workout" && state === "done" ? workout : "",
        advance: c.kind === "workout" && state === "done" && advance,
      });
      onSaved();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not save. Your edits are still here.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title={c.name}
      description={`${date} · ${habitGoalLabel(c)}`}
    >
      <p className="mb-4 text-sm text-muted">
        Saved status: {habitResult(c, r)}
      </p>
      {date > today && (
        <p className="mb-4 text-sm text-muted">
          Future date. You can record progress when this day arrives.
        </p>
      )}
      {h.archived && (
        <p className="mb-4 text-xs text-muted">
          Archived habit · correcting its saved history.
        </p>
      )}
      <form onSubmit={save} className="space-y-4">
        <fieldset disabled={disabled} className="space-y-4">
          {c.kind === "binary" && (
            <div
              role="group"
              aria-label="Daily observation"
              className="flex flex-wrap gap-2"
            >
              <Button
                aria-pressed={state === "done"}
                onClick={() => setState("done")}
              >
                {habitDirection(c) === "build"
                  ? "Mark completed"
                  : "Did activity"}
              </Button>
              <Button
                aria-pressed={state === "notDone"}
                onClick={() => setState("notDone")}
              >
                {habitDirection(c) === "build"
                  ? "Undo completion"
                  : "Did not do"}
              </Button>
            </div>
          )}
          {c.kind === "quantity" && (
            <label>
              Daily total · {c.unit}
              <input
                name="quantity"
                type="number"
                min={0}
                max={1000000000}
                step="0.001"
                required={state !== "unlogged"}
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value);
                  setState("done");
                }}
              />
              <span className="text-xs text-muted">
                Save replaces this date’s total. Explicit zero is recorded; an
                unlogged day is unknown.
              </span>
            </label>
          )}
          {c.kind === "workout" && (
            <>
              {planned && (
                <p className="text-sm text-muted">
                  Planned / next: {planned}. Rest is neutral and does not
                  advance the rotation.
                </p>
              )}
              <label>
                Workout entry
                <select
                  value={state}
                  onChange={(e) => {
                    setState(e.target.value as HabitRecord["state"]);
                    setAdvance(false);
                  }}
                >
                  <option value="unlogged">Not logged</option>
                  <option value="done">Workout completed</option>
                  <option value="notDone">No workout / undo completion</option>
                  <option value="rest">Rest day</option>
                </select>
              </label>
              <label>
                Actual workout
                <input
                  value={workout}
                  onChange={(e) => {
                    setWorkout(e.target.value);
                    setState("done");
                  }}
                  required={state === "done"}
                  maxLength={60}
                  list={`log-workouts-${h.id}`}
                  placeholder="Select or enter workout"
                />
                <datalist id={`log-workouts-${h.id}`}>
                  {Array.from(new Set([...c.rotation, "Cardio", "Full Body"]))
                    .filter((x) => x.toLowerCase() !== "rest")
                    .map((x) => (
                      <option key={x} value={x} />
                    ))}
                </datalist>
              </label>
              {date === today && r?.state !== "done" && state === "done" && (
                <label className="flex min-h-11 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={advance}
                    onChange={(e) => setAdvance(e.target.checked)}
                  />
                  Also advance from the planned step
                </label>
              )}
            </>
          )}
          <Button
            variant="ghost"
            onClick={() => {
              setState("unlogged");
              setQuantity("");
              setWorkout("");
              setAdvance(false);
            }}
          >
            Clear daily record
          </Button>
        </fieldset>
        {dirty && (
          <p role="status" className="text-xs text-muted">
            Unsaved changes
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error} Your edits have been kept.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary" disabled={disabled}>
            {busy ? "Saving…" : "Save and close"}
          </Button>
          <Button disabled={busy} onClick={close}>
            Cancel
          </Button>
        </div>
      </form>
      {discard && (
        <div role="alert" className="mt-4 rounded-lg border border-warning p-3">
          <p className="mb-2 text-sm">Discard unsaved changes?</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setDiscard(false)}>Keep editing</Button>
            <Button onClick={onClose}>Discard changes</Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
