"use client";
import { useRef, useState, type FormEvent } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePlannerQuery } from "@/lib/use-planner-query";
import { sendCommand } from "@/lib/api";
import { weekdays, type GeneralScheduleData } from "@/lib/general-schedule";
export function GeneralScheduleDialog({
  id,
  onClose,
  onSaved,
}: {
  id: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false),
    [discard, setDiscard] = useState(false);
  const { data, error, reload } = usePlannerQuery<GeneralScheduleData>(
    `/api/planner?view=generalSchedule&id=${encodeURIComponent(id)}`,
  );
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
      title="Edit future recurring schedule"
      description="Changes apply from the chosen date. Past activities and edited, moved, logged, completed or skipped exceptions are preserved."
    >
      {data ? (
        <div onChange={() => setDirty(true)}>
          <Editor
            initial={data}
            onSaved={onSaved}
            onClose={onClose}
            busy={busy}
            setBusy={setBusy}
          />
        </div>
      ) : error ? (
        <>
          <p role="alert">{error}</p>
          <Button onClick={reload}>Retry</Button>
        </>
      ) : (
        <p role="status">Loading schedule…</p>
      )}
      {discard && (
        <div className="mt-3">
          <p>Discard unsaved schedule changes?</p>
          <Button onClick={() => setDiscard(false)}>Keep editing</Button>
          <Button variant="danger" onClick={onClose}>
            Discard
          </Button>
        </div>
      )}
    </Dialog>
  );
}
function Editor({
  busy,
  setBusy,
  initial,
  onSaved,
  onClose,
}: {
  busy: boolean;
  setBusy: (v: boolean) => void;
  initial: GeneralScheduleData;
  onSaved: (m: string) => void;
  onClose: () => void;
}) {
  const [snapshot] = useState(initial),
    [error, setError] = useState("");
  const gate = useRef(false);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (gate.current) return;
    gate.current = true;
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      await sendCommand({
        action: "generalScheduleSave",
        templateId: snapshot.templateId,
        version: snapshot.version,
        effectiveFrom: String(f.get("from")),
        config: {
          title: String(f.get("title")),
          summary: String(f.get("summary")),
          weekday: Number(f.get("weekday")),
          time: String(f.get("time")) || null,
          minutes: Number(f.get("minutes")),
          optional: snapshot.config.optional,
        },
      });
      onSaved(
        "Future weekly schedule updated. Historical and edited exceptions were preserved.",
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update schedule.");
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  const min =
    snapshot.today > snapshot.effectiveFrom
      ? snapshot.today
      : snapshot.effectiveFrom;
  return (
    <form onSubmit={save} className="space-y-3">
      <fieldset disabled={busy} className="space-y-3">
        <label>
          Apply from
          <input
            name="from"
            type="date"
            min={min}
            defaultValue={min}
            required
          />
        </label>
        <label>
          Title
          <input
            name="title"
            defaultValue={snapshot.config.title}
            maxLength={160}
            required
          />
        </label>
        <label>
          Every week on
          <select name="weekday" defaultValue={snapshot.config.weekday}>
            {weekdays.map((day, i) => (
              <option key={day} value={i + 1}>
                {day}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label>
            Suggested start
            <input
              name="time"
              type="time"
              defaultValue={snapshot.config.time ?? ""}
            />
          </label>
          <label>
            Minutes
            <input
              name="minutes"
              type="number"
              min={1}
              max={1440}
              required
              defaultValue={snapshot.config.minutes}
            />
          </label>
        </div>
        <label>
          Description
          <textarea
            name="summary"
            maxLength={500}
            rows={2}
            defaultValue={snapshot.config.summary}
          />
        </label>
        <p className="text-xs text-muted">
          If the weekday changes, preserved exceptions may remain alongside the
          new schedule. This does not move those activities.
        </p>
        <Button type="submit" variant="primary">
          {busy ? "Saving…" : "Confirm future schedule"}
        </Button>
      </fieldset>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
