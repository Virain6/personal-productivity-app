"use client";
import { useState, type FormEvent } from "react";
import {
  habitDirection,
  type HabitDirection,
  type HabitConfig,
  type HabitView,
} from "@/lib/habit-types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { sendCommand } from "@/lib/api";
const defaults: HabitConfig = {
  name: "",
  kind: "binary",
  unit: "",
  goal: "awareness",
  target: null,
  schedule: "daily",
  weekdays: [1, 2, 3, 4, 5],
  timesPerWeek: 3,
  rotation: ["Push", "Pull", "Legs", "Rest"],
};
export function HabitEditor({
  habit,
  onClose,
}: {
  habit: HabitView | null;
  onClose: () => void;
}) {
  const c = habit?.config ?? defaults;
  const [kind, setKind] = useState(c.kind),
    [schedule, setSchedule] = useState(c.schedule),
    [direction, setDirection] = useState<HabitDirection>(habitDirection(c));
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    const config: HabitConfig = {
      name: String(f.get("name")),
      kind,
      unit: kind === "quantity" ? String(f.get("unit")) : "",
      direction,
      goal:
        direction !== "build"
          ? "atMost"
          : kind === "quantity" && f.get("target") !== ""
            ? "atLeast"
            : "awareness",
      target:
        direction === "avoid"
          ? 0
          : f.get("target") !== null && f.get("target") !== ""
            ? Number(f.get("target"))
            : null,
      schedule,
      weekdays: f.getAll("weekday").map(Number),
      timesPerWeek: Number(f.get("times") ?? 3),
      rotation:
        kind === "workout"
          ? String(f.get("rotation"))
              .split("\n")
              .map((x) => x.trim())
              .filter(Boolean)
          : [],
    };
    try {
      await sendCommand(
        habit
          ? {
              action: "habitEdit",
              id: habit.id,
              version: habit.version,
              config,
            }
          : { action: "habitCreate", config },
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save habit.");
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
      title={habit ? "Edit habit" : "Create a habit"}
      description="Keep it simple. Choose what to record and when it fits your week."
    >
      <form onSubmit={save} className="space-y-4">
        <label>
          Name
          <input name="name" required maxLength={100} defaultValue={c.name} />
        </label>
        <label>
          Habit type
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as HabitConfig["kind"])}
          >
            <option value="binary">Binary · completed or not</option>
            <option value="quantity">Quantity · a daily total</option>
            <option value="workout">Workout · actual workout performed</option>
          </select>
        </label>
        {kind === "quantity" && (
          <>
            <label>
              Unit
              <input
                name="unit"
                required
                maxLength={30}
                placeholder="mL, drinks, pages…"
                defaultValue={c.unit}
              />
            </label>
          </>
        )}
        <label>
          Goal direction
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as HabitDirection)}
          >
            <option value="build">Build / maintain</option>
            <option value="limit">Limit / reduce</option>
            <option value="avoid">Avoid entirely</option>
          </select>
        </label>
        {direction === "avoid" ? (
          <p className="text-xs text-muted">
            The goal is zero. Record what happened, including an explicit zero
            or “Did not do”. Missing entries stay not logged.
          </p>
        ) : (
          (kind === "quantity" || direction === "limit") && (
            <label>
              {direction === "limit"
                ? "Daily limit"
                : "Daily target · optional"}
              <input
                key={`${kind}:${direction}`}
                name="target"
                type="number"
                min={0}
                max={kind === "quantity" ? 1000000000 : 1}
                step={kind === "quantity" ? "0.001" : "1"}
                required={direction === "limit"}
                defaultValue={c.target ?? ""}
              />
              <span className="text-xs text-muted">
                {kind !== "quantity"
                  ? "0 or 1 occurrence per day. Use quantity to measure larger limits."
                  : direction === "build"
                    ? "Leave blank for awareness only."
                    : "Zero is a valid daily limit."}
              </span>
            </label>
          )
        )}
        <label>
          Schedule
          <select
            value={schedule}
            onChange={(e) =>
              setSchedule(e.target.value as HabitConfig["schedule"])
            }
          >
            <option value="daily">Every day</option>
            <option value="weekdays">Selected weekdays</option>
            <option value="weekly">A number of times per week</option>
          </select>
        </label>
        {schedule === "weekdays" && (
          <fieldset>
            <legend className="mb-2 text-sm">Expected days</legend>
            <div className="flex flex-wrap gap-2">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                (name, i) => (
                  <label
                    key={name}
                    className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3"
                  >
                    <input
                      type="checkbox"
                      name="weekday"
                      value={i + 1}
                      defaultChecked={c.weekdays.includes(i + 1)}
                    />
                    {name}
                  </label>
                ),
              )}
            </div>
          </fieldset>
        )}
        {schedule === "weekly" && (
          <label>
            Days per week
            <input
              name="times"
              type="number"
              min={1}
              max={7}
              defaultValue={c.timesPerWeek}
              required
            />
            <span className="text-xs text-muted">
              Any days, Monday–Sunday. No specific day is marked missed.
            </span>
          </label>
        )}
        {kind === "workout" && (
          <label>
            Workout rotation · one step per line
            <textarea
              name="rotation"
              rows={5}
              required
              defaultValue={
                c.rotation.length
                  ? c.rotation.join("\n")
                  : defaults.rotation.join("\n")
              }
            />
            <span className="text-xs text-muted">
              Include Rest if useful. Missed days never advance the rotation.
              Rest is recorded separately; choose the next step manually when
              ready.
            </span>
          </label>
        )}
        {habit && (
          <p className="text-xs text-muted">
            Changes apply from today to new records. Existing daily records keep
            their original type, unit, goal direction, target and schedule.
            Changing the workout rotation resets its next step.
          </p>
        )}
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "Saving…" : "Save habit"}
        </Button>
      </form>
    </Dialog>
  );
}
