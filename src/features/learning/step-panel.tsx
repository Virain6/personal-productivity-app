"use client";
import { roadmapStyle } from "@/lib/roadmap-colors";
import { useState, useEffect, type ReactNode } from "react";
import { DateTime } from "luxon";
import { ArrowUp, ArrowDown, Play, Check } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTimer } from "@/features/timer/timer-provider";
import { usePlannerQuery } from "@/lib/use-planner-query";
import { localDate, formatDuration } from "@/lib/dates";
import type { HomeData } from "@/lib/planner-types";
import {
  stepStatuses,
  stepStatusNames,
  stepStudyTime,
  type LearningStep,
  type LearningSection,
  type Roadmap,
  type LearningData,
} from "@/lib/learning-types";
export function StepPanel({
  data,
  roadmap,
  section,
  step,
  busy,
  notice,
  onClose,
  onEdit,
  onChange,
  onRemove,
  onMove,
}: {
  data: LearningData;
  roadmap: Roadmap;
  section: LearningSection;
  step: LearningStep;
  busy: boolean;
  notice?: ReactNode;
  onClose: () => void;
  onEdit: () => void;
  onChange: (o: Record<string, unknown>) => void;
  onRemove: () => void;
  onMove: (delta: number) => void;
}) {
  const timer = useTimer();
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  const today = localDate(clock, data.timezone);
  const tasks = usePlannerQuery<HomeData>(
    `/api/planner?from=${today}&to=${today}`,
  );
  const [taskId, setTaskId] = useState("");
  const [error, setError] = useState("");
  const available =
    tasks.data?.tasks.filter(
      (t) => t.status !== "done" && t.status !== "skipped",
    ) ?? [];
  const history = data.studyHistory.filter((s) => s.stepId === step.id),
    index = section.steps.findIndex((s) => s.id === step.id);
  async function start() {
    setError("");
    try {
      await timer.start(taskId, step.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start studying.");
    }
  }
  return (
    <Dialog
      open
      layout="panel"
      onOpenChange={(open) => {
        if (!open && !busy && !timer.busy) onClose();
      }}
      title={step.title}
      description={`${roadmap.title} / ${section.title}`}
    >
      <div className="space-y-5" style={roadmapStyle(roadmap.color)}>
        {notice}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            className={`rounded-full border border-border px-3 py-1 text-xs ${step.status === "needs_review" ? "text-warning" : step.completed ? "text-success" : "text-accent-hover"}`}
          >
            {stepStatusNames[step.status]}
          </span>
          <span className="numeric text-sm text-muted">
            {formatDuration(stepStudyTime(data.studyHistory, step.id))} studied
          </span>
        </div>
        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">
            About this step
          </h3>
          <p className="whitespace-pre-wrap break-words text-sm">
            {step.description || "No description yet."}
          </p>
        </section>
        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">
            Learning goal
          </h3>
          <p className="whitespace-pre-wrap break-words text-sm">
            {step.objective ||
              "Define what understanding this topic looks like."}
          </p>
        </section>
        {step.resourceUrl && (
          <a
            className="inline-flex min-h-11 items-center text-sm text-accent-hover underline"
            href={step.resourceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open resource ↗
          </a>
        )}
        <label>
          Status
          <select
            value={step.status}
            disabled={busy || roadmap.archived}
            onChange={(e) =>
              onChange({ kind: "status", id: step.id, status: e.target.value })
            }
          >
            {stepStatuses.map((status) => (
              <option value={status} key={status}>
                {stepStatusNames[status]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy || roadmap.archived}
            onClick={() =>
              onChange({
                kind: "complete",
                id: step.id,
                completed: !step.completed,
              })
            }
          >
            <Check size={15} />
            {step.completed ? "Undo completion" : "Mark complete"}
          </Button>
          <Button
            disabled={
              busy || roadmap.archived || roadmap.currentStepId === step.id
            }
            onClick={() => onChange({ kind: "current", id: step.id })}
          >
            Set current topic
          </Button>
        </div>
        <section className="space-y-3 rounded-xl border border-border bg-background p-3">
          <h3 className="text-sm font-medium">Study this step</h3>
          <label>
            Today&apos;s activity
            <select
              value={taskId}
              disabled={timer.busy || roadmap.archived}
              onChange={(e) => setTaskId(e.target.value)}
            >
              <option value="">Choose an existing activity</option>
              {available.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-muted">
            Uses your existing timer and links this session to the step. Mastery
            stays unchanged.
          </p>
          {tasks.error && (
            <p role="alert" className="text-xs text-danger">
              {tasks.error}
              <Button onClick={tasks.reload}>Retry activities</Button>
            </p>
          )}
          {tasks.data && !available.length && (
            <p className="text-xs text-muted">
              No open activity today. Add or reopen one on Home to study.
            </p>
          )}
          {error && (
            <p role="alert" className="text-xs text-danger">
              {error}
            </p>
          )}
          <Button
            variant="primary"
            disabled={
              timer.busy ||
              busy ||
              roadmap.archived ||
              !available.some((t) => t.id === taskId) ||
              timer.running?.taskId === taskId
            }
            onClick={() => void start()}
          >
            <Play size={14} />
            Start studying
          </Button>
          {timer.running?.taskId === taskId && (
            <p className="text-xs text-muted">
              This activity is already running. Change its session topic in Home
              details, or pause before starting a new session.
            </p>
          )}
        </section>
        <section>
          <h3 className="mb-3 text-sm font-medium">Recent sessions</h3>
          {!history.length && (
            <p className="text-xs text-muted">No linked sessions yet.</p>
          )}
          <ul className="space-y-3">
            {history.slice(0, 8).map((s) => (
              <li
                key={s.sessionId}
                className="border-l border-border pl-3 text-xs"
              >
                <p className="text-muted">
                  {DateTime.fromMillis(s.startedAt, {
                    zone: data.timezone,
                  }).toFormat("MMM d, yyyy HH:mm ZZ")}{" "}
                  ·{" "}
                  {s.endedAt === null
                    ? "Running"
                    : formatDuration(s.endedAt - s.startedAt)}
                </p>
                <p className="mt-1 break-words">{s.summary || s.stepTitle}</p>
              </li>
            ))}
          </ul>
          {history.length > 8 && (
            <p className="mt-2 text-xs text-muted">
              Latest 8 sessions. Full history is on the roadmap.
            </p>
          )}
        </section>
        <div className="flex flex-wrap gap-1 border-t border-border pt-3">
          <Button disabled={busy || roadmap.archived} onClick={onEdit}>
            Edit step
          </Button>
          <Button
            variant="ghost"
            disabled={busy || roadmap.archived}
            onClick={onRemove}
          >
            Delete step
          </Button>
          <Button
            variant="ghost"
            aria-label="Move step up"
            disabled={busy || roadmap.archived || index === 0}
            onClick={() => onMove(-1)}
          >
            <ArrowUp size={15} />
          </Button>
          <Button
            variant="ghost"
            aria-label="Move step down"
            disabled={
              busy || roadmap.archived || index === section.steps.length - 1
            }
            onClick={() => onMove(1)}
          >
            <ArrowDown size={15} />
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
