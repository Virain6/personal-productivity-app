"use client";
import { useRef, useState } from "react";
import { Leaf, Plus, Minus, Pencil, LoaderCircle } from "lucide-react";
import {
  habitDirection,
  habitOutcome,
  habitResult,
  plannedWorkout,
  type HabitView,
} from "@/lib/habit-types";
import {
  habitQuickStep,
  quickHabitRecord,
  type HabitQuickMode,
} from "@/lib/habit-quick";
import {
  CalendarStatusIcon,
  calendarCardClass,
  type CalendarState,
} from "@/components/calendar-status";
import { sendCommand } from "@/lib/api";
export function CalendarHabit({
  habit: h,
  date,
  today,
  onOpen,
}: {
  habit: HabitView;
  date: string;
  today: string;
  onOpen: () => void;
}) {
  const c = h.dateConfig!,
    r = h.record;
  const outcome = habitOutcome(c, r);
  const state: CalendarState =
    outcome === "met"
      ? "success"
      : outcome === "exceeded"
        ? habitDirection(c) === "avoid"
          ? "danger"
          : "warning"
        : outcome === "rest"
          ? "rest"
          : "neutral";
  const step = habitQuickStep(h);
  const planned = plannedWorkout(h, date, today);
  const [sending, setSending] = useState(false);
  const [waitingVersion, setWaitingVersion] = useState<number | null>(null);
  const [failure, setFailure] = useState<{
    message: string;
    command: Record<string, unknown>;
  } | null>(null);
  const gate = useRef({ sending: false, version: -1, notBefore: 0 });
  const busy = sending || waitingVersion === h.version;
  const disabled = busy || !!failure || date > today || (h.archived && !r);
  async function submit(command: Record<string, unknown>, retry = false) {
    if (
      gate.current.sending ||
      gate.current.version === h.version ||
      (!retry && Date.now() < gate.current.notBefore)
    )
      return;
    gate.current.sending = true;
    gate.current.notBefore = Date.now() + 500;
    setSending(true);
    setFailure(null);
    try {
      await sendCommand(command);
      const version = Number(command.version);
      gate.current.version = version;
      setWaitingVersion(version);
    } catch (e) {
      setFailure({
        message: e instanceof Error ? e.message : "Could not save.",
        command,
      });
    } finally {
      gate.current.sending = false;
      setSending(false);
    }
  }
  function quick(mode: HabitQuickMode) {
    if (disabled) return;
    if (!quickHabitRecord(h, date, today, mode)) {
      onOpen();
      return;
    }
    void submit({
      action: "habitQuick",
      id: h.id,
      version: h.version,
      date,
      revisionId: h.revisionId,
      entryVersion: r?.version ?? 0,
      mode,
    });
  }
  const toggle = quickHabitRecord(h, date, today, "toggle");
  const toggleLabel =
    c.kind === "binary"
      ? habitDirection(c) === "build"
        ? r?.state === "done"
          ? "Undo"
          : "Complete"
        : r?.state === "notDone"
          ? "Clear none recorded for"
          : "None today for"
      : r?.state === "done"
        ? "Undo workout for"
        : toggle
          ? `Complete ${toggle.workout} and advance for`
          : "Choose workout for";
  const control =
    "flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-elevated disabled:opacity-40";
  return (
    <article
      className={calendarCardClass(state)}
      data-state={state}
      aria-busy={busy}
    >
      <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-success">
        <Leaf size={11} aria-hidden="true" />
        Habit{h.archived ? " · Archived" : ""}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onOpen}
          disabled={sending}
          aria-label={`Log ${c.name} for ${date}`}
          className={`min-h-11 min-w-0 flex-1 break-words py-1 text-left text-[13px] font-medium leading-snug hover:text-accent-hover ${state === "success" ? "text-muted" : ""}`}
        >
          {c.name}
          <span className="mt-1 block text-[11px] font-normal text-muted">
            {habitResult(c, r)}
          </span>
          {c.kind === "workout" && (
            <span className="mt-1 block text-[11px] font-normal text-muted">
              {r?.workout
                ? `Actual: ${r.workout}`
                : planned
                  ? `Next: ${planned}${toggle?.advance ? " · advances" : ""}`
                  : "Choose workout"}
            </span>
          )}
        </button>
        {c.kind !== "quantity" ? (
          <button
            className={control}
            disabled={disabled}
            onClick={() => quick("toggle")}
            aria-label={`${toggleLabel} ${c.name} on ${date}`}
            title={`${toggleLabel} ${c.name}`}
          >
            {busy ? (
              <LoaderCircle aria-hidden="true" size={18} />
            ) : !toggle ? (
              <Pencil aria-hidden="true" size={18} />
            ) : (
              <CalendarStatusIcon state={state} />
            )}
          </button>
        ) : (
          <span className="p-1">
            <CalendarStatusIcon state={state} />
          </span>
        )}
      </div>
      {c.kind === "quantity" && (
        <div className="flex flex-wrap items-center gap-1">
          {habitDirection(c) !== "build" && (
            <button
              disabled={disabled}
              className="min-h-11 rounded-md px-2 text-xs hover:bg-elevated disabled:opacity-40"
              aria-label={`Log zero for ${c.name} on ${date}`}
              onClick={() => quick("zero")}
            >
              Log 0
            </button>
          )}
          {step ? (
            <>
              <button
                className={control}
                disabled={
                  disabled || !quickHabitRecord(h, date, today, "decrement")
                }
                aria-label={`Subtract ${step} ${c.unit} from ${c.name} on ${date}`}
                onClick={() => quick("decrement")}
              >
                <Minus aria-hidden="true" size={16} />
              </button>
              <button
                className={control}
                disabled={disabled}
                aria-label={`Add ${step} ${c.unit} to ${c.name} on ${date}`}
                title={
                  r?.quantityMilli == null
                    ? "Enter a starting total"
                    : `Add ${step} ${c.unit}`
                }
                onClick={() => quick("increment")}
              >
                <Plus aria-hidden="true" size={16} />
              </button>
            </>
          ) : (
            <button
              className={control}
              disabled={disabled}
              aria-label={`Enter total for ${c.name} on ${date}`}
              onClick={onOpen}
            >
              <Pencil aria-hidden="true" size={16} />
            </button>
          )}
        </div>
      )}
      {c.schedule === "weekly" && (
        <p className="text-[10px] text-muted">
          Flexible · {c.timesPerWeek} days/week
        </p>
      )}
      {date > today && <p className="text-[10px] text-muted">Future</p>}
      {busy && (
        <p role="status" className="text-xs text-muted">
          {sending ? "Saving…" : "Saved · refreshing…"}
        </p>
      )}
      {failure && (
        <div role="alert" className="mt-1 text-xs text-warning">
          {failure.message}
          <div className="flex flex-wrap gap-1">
            <button
              className="min-h-11 px-2"
              disabled={sending}
              onClick={() => void submit(failure.command, true)}
            >
              Retry save
            </button>
            <button
              className="min-h-11 px-2"
              onClick={() => {
                setFailure(null);
                onOpen();
              }}
            >
              Review entry
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
