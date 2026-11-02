"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import type { Category, Session } from "@/lib/planner-types";
import type { LearningData } from "@/lib/learning-types";
import { Button } from "@/components/ui/button";
import { sendCommand } from "@/lib/api";

export function StepSelect({
  data,
  value,
  onChange,
  label,
  disabled = false,
}: {
  data: LearningData;
  category: Category;
  value: string;
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
}) {
  const maps = data.roadmaps.filter((m) => !m.archived);
  const available = maps.some((m) =>
    m.sections.some(
      (s) => !s.archived && s.steps.some((step) => step.id === value),
    ),
  );
  return (
    <label>
      {label}
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">No learning step</option>
        {value && !available && (
          <option value={value} disabled>
            Existing topic (unavailable for new sessions)
          </option>
        )}
        {maps.map((m) => (
          <optgroup key={m.id} label={m.title}>
            {m.sections
              .filter((s) => !s.archived)
              .flatMap((s) =>
                s.steps.map((step) => (
                  <option key={step.id} value={step.id}>
                    {s.title} / {step.title}
                    {step.id === m.currentStepId ? " · Current" : ""}
                    {step.completed ? " · Complete" : ""}
                  </option>
                )),
              )}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
export function TopicDescription({
  data,
  stepId,
}: {
  data: LearningData;
  stepId: string;
}) {
  for (const m of data.roadmaps)
    for (const s of m.sections) {
      const step = s.steps.find((x) => x.id === stepId);
      if (step)
        return (
          <p className="text-xs text-muted break-words">
            {s.title} / {step.title} ·{" "}
            <Link
              className="text-accent-hover underline"
              href={`/learning/${m.id}`}
            >
              Open {m.title}
            </Link>
          </p>
        );
    }
  return null;
}
export function SessionTopicEditor({
  session,
  data,
  category,
  onClose,
  onSaved,
}: {
  session: Session;
  data: LearningData;
  category: Category;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [stepId, setStepId] = useState(session.learning?.stepId ?? "");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const gate = useRef(false);
  async function save() {
    if (gate.current) return;
    gate.current = true;
    setBusy(true);
    setError("");
    try {
      await sendCommand({
        action: "sessionTopic",
        id: session.id,
        version: session.learning?.version ?? 0,
        stepId: stepId || null,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save topic.");
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="my-3 space-y-2 rounded-lg border border-border p-3">
      <StepSelect
        data={data}
        category={category}
        value={stepId}
        onChange={setStepId}
        disabled={busy}
        label="Session learning step"
      />
      <p className="text-xs text-muted">
        Changes only this session&apos;s topic. Recorded time and mastery stay
        unchanged.
      </p>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      <Button disabled={busy} onClick={() => void save()}>
        Save session topic
      </Button>
      <Button variant="ghost" disabled={busy} onClick={onClose}>
        Cancel topic edit
      </Button>
    </div>
  );
}
