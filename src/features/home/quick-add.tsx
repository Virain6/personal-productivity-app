"use client";
import { useRef, useState, type FormEvent } from "react";
import { DateTime } from "luxon";
import Link from "next/link";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { sendCommand } from "@/lib/api";
import { usePlannerQuery } from "@/lib/use-planner-query";
import type { LearningData } from "@/lib/learning-types";
import { roadmapColor } from "@/lib/roadmap-colors";
import { StepSelect } from "@/features/learning/study-controls";

export function QuickAdd({
  date,
  onClose,
  onSaved,
}: {
  date: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [kind, setKind] = useState("general");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [dirty, setDirty] = useState(false),
    [discard, setDiscard] = useState(false);
  const gate = useRef(false);
  async function submit(command: Record<string, unknown>, message: string) {
    if (gate.current) return;
    gate.current = true;
    setBusy(true);
    setError("");
    try {
      await sendCommand(command);
      onSaved(message);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add activity.");
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
        if (!open && !busy) {
          if (dirty) setDiscard(true);
          else onClose();
        }
      }}
      title="Quick Add"
      description="Add an activity to your selected date."
    >
      <div onChange={() => setDirty(true)}>
        <label>
          Activity type
          <select
            disabled={busy}
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="general">General task</option>
            <option value="learning">Roadmap study session</option>
          </select>
        </label>
        {kind === "general" ? (
          <GeneralAdd date={date} busy={busy} submit={submit} />
        ) : (
          <LearningAdd date={date} busy={busy} submit={submit} />
        )}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-danger">
          {error}
        </p>
      )}
      {discard && (
        <div className="mt-3 rounded-lg border border-border p-3">
          <p>Discard this unsaved activity?</p>
          <Button onClick={() => setDiscard(false)}>Keep editing</Button>
          <Button variant="danger" onClick={onClose}>
            Discard
          </Button>
        </div>
      )}
    </Dialog>
  );
}
function GeneralAdd({
  date,
  busy,
  submit,
}: {
  date: string;
  busy: boolean;
  submit: (c: Record<string, unknown>, m: string) => Promise<void>;
}) {
  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      day = String(f.get("date")),
      title = String(f.get("title")),
      summary = String(f.get("summary")),
      time = String(f.get("time")) || null,
      minutes = Number(f.get("minutes") || 30);
    void submit(
      f.get("repeat") === "weekly"
        ? {
            action: "generalScheduleSave",
            version: 0,
            effectiveFrom: day,
            config: {
              title,
              summary,
              weekday: DateTime.fromISO(day).weekday,
              time,
              minutes,
              optional: false,
            },
          }
        : {
            action: "create",
            fields: {
              title,
              summary,
              category: "Other",
              plannedDate: day,
              mode: "flexible",
              suggestedTime: time,
              targetMinutes: minutes,
              fixedStart: null,
              fixedEnd: null,
              optional: false,
            },
          },
      f.get("repeat") === "weekly" ? "Weekly activity added." : "Task added.",
    );
  }
  return (
    <form onSubmit={save} className="mt-4 space-y-3">
      <fieldset disabled={busy} className="space-y-3">
        <label>
          Title
          <input name="title" required maxLength={160} />
        </label>
        <ScheduleFields date={date} minutes={30} />
        <label>
          Repeat
          <select name="repeat">
            <option value="once">Does not repeat</option>
            <option value="weekly">
              Weekly on the selected date’s weekday
            </option>
          </select>
        </label>
        <details>
          <summary className="min-h-11 cursor-pointer py-3 text-sm text-muted">
            Add a description · optional
          </summary>
          <label>
            Description
            <textarea name="summary" rows={2} maxLength={500} />
          </label>
        </details>
        <Button type="submit" variant="primary">
          {busy ? "Saving…" : "Add task"}
        </Button>
      </fieldset>
    </form>
  );
}
function LearningAdd({
  date,
  busy,
  submit,
}: {
  date: string;
  busy: boolean;
  submit: (c: Record<string, unknown>, m: string) => Promise<void>;
}) {
  const { data, error, reload } = usePlannerQuery<LearningData>(
    "/api/planner?view=learning",
  );
  const [roadmapId, setRoadmapId] = useState(""),
    [stepId, setStepId] = useState("");
  if (!data)
    return (
      <div className="mt-3">
        {error ? (
          <>
            <p role="alert">{error}</p>
            <Button onClick={reload}>Retry</Button>
          </>
        ) : (
          <p role="status">Loading roadmaps…</p>
        )}
      </div>
    );
  const maps = data.roadmaps.filter((m) => !m.archived),
    selected = maps.find((m) => m.id === roadmapId);
  if (!maps.length)
    return (
      <p className="my-4 text-muted">
        Create a roadmap in{" "}
        <Link href="/learning" className="underline">
          Learning
        </Link>{" "}
        first.
      </p>
    );
  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void submit(
      {
        action: "studyTask",
        roadmapId,
        ...(stepId ? { stepId } : {}),
        date: String(f.get("date")),
        time: String(f.get("time")) || null,
        minutes: Number(f.get("minutes") || 60),
        additional: f.get("additional") === "on",
      },
      "Study activity ready. Existing open sessions are reused unless an additional activity was requested.",
    );
  }
  return (
    <form onSubmit={save} className="mt-4 space-y-3">
      <fieldset disabled={busy} className="space-y-3">
        <label>
          Roadmap
          <select
            required
            value={roadmapId}
            onChange={(e) => {
              setRoadmapId(e.target.value);
              setStepId("");
            }}
          >
            <option value="">Choose a roadmap</option>
            {maps.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </label>
        {selected && (
          <>
            <p
              className="border-l-2 pl-3 text-sm"
              style={{
                borderColor: roadmapColor(selected.color),
                color: roadmapColor(selected.color),
              }}
            >
              {selected.title}
            </p>
            <StepSelect
              data={{ ...data, roadmaps: [selected] }}
              category="Other"
              value={stepId}
              onChange={setStepId}
              label="Module / learning step · optional"
            />
          </>
        )}
        <ScheduleFields date={date} minutes={60} />
        <p className="text-xs text-muted">
          Reuses an open activity for this roadmap on the chosen date, retaining
          its time and duration. Choose an additional activity for a separate
          session. No timer starts until you choose Start.
        </p>
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" name="additional" />
          Create an additional activity on this date
        </label>
        <Button type="submit" variant="primary" disabled={!selected}>
          {busy ? "Saving…" : "Add study session"}
        </Button>
      </fieldset>
    </form>
  );
}
function ScheduleFields({ date, minutes }: { date: string; minutes: number }) {
  return (
    <>
      <label>
        Date
        <input type="date" name="date" required defaultValue={date} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label>
          Start · optional
          <input name="time" type="time" />
        </label>
        <label>
          Minutes · optional
          <input
            name="minutes"
            type="number"
            min={1}
            max={1440}
            placeholder={String(minutes)}
          />
        </label>
      </div>
      <p className="text-xs text-muted">
        Anytime if no start is set. Blank duration uses {minutes} minutes.
      </p>
    </>
  );
}
