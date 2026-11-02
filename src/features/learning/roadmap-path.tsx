"use client";
import Link from "next/link";
import { Check, ArrowUp, ArrowDown, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  roadmapProgress,
  stepStatusNames,
  stepStudyTime,
  type Roadmap,
  type LearningSection,
  type LearningStep,
  type StudyHistory,
} from "@/lib/learning-types";
import styles from "./learning.module.css";
type Props = {
  roadmap: Roadmap;
  focused?: boolean;
  history: StudyHistory[];
  busy: boolean;
  onSelect: (id: string) => void;
  onChange: (operation: Record<string, unknown>) => void;
  onEdit: (section: LearningSection, step?: LearningStep) => void;
  onAdd: (section: LearningSection) => void;
  onRemove: (id: string, title: string, step: boolean) => void;
  onMove: (
    ids: string[],
    index: number,
    delta: number,
    sectionId: string | null,
  ) => void;
};
export function RoadmapPath({
  roadmap: m,
  focused = false,
  history,
  busy,
  onSelect,
  onChange,
  onEdit,
  onAdd,
  onRemove,
  onMove,
}: Props) {
  return (
    <div
      className={focused ? "space-y-3" : styles.path}
      aria-label="Learning path"
    >
      {m.sections.map((section, index) => {
        const progress = roadmapProgress([{ ...section, archived: false }]),
          current = section.steps.some((s) => s.id === m.currentStepId),
          complete =
            progress.total > 0 && progress.completed === progress.total;
        return (
          <details
            key={section.id}
            id={`module-${section.id}`}
            open={current || index === 0}
            className={styles.module}
            data-current={current}
          >
            <summary className="min-h-11 cursor-pointer rounded-xl px-4 py-4 text-sm font-medium">
              {!focused && (
                <span
                  className={styles.node}
                  data-complete={complete}
                  aria-label={
                    complete ? "Module completed" : `Module ${index + 1}`
                  }
                >
                  {complete ? (
                    <Check size={14} aria-hidden="true" />
                  ) : (
                    index + 1
                  )}
                </span>
              )}
              <span className="break-words">
                {focused ? "Learning steps" : section.title}
              </span>
              <span className="ml-2 text-xs font-normal text-muted">
                {progress.completed}/{progress.total}
              </span>
              {!focused && current && (
                <span className="ml-2 text-xs text-accent-hover">
                  Current module
                </span>
              )}
              {!focused && (
                <progress
                  className={`${styles.progress} mt-2`}
                  aria-label={`${section.title} progress`}
                  value={progress.percent}
                  max={100}
                />
              )}
            </summary>
            {!focused && (
              <Link
                href={`/learning/${m.id}/modules/${section.id}`}
                className="mx-4 inline-flex min-h-11 items-center text-xs text-accent-hover"
              >
                Open module →{section.archived ? " (Archived)" : ""}
              </Link>
            )}
            {(section.description ||
              section.objective ||
              section.resourceUrl) && (
              <div className="space-y-2 px-4 pb-3 text-xs text-muted">
                {!focused && section.description && (
                  <p className="whitespace-pre-wrap break-words">
                    {section.description}
                  </p>
                )}
                {!focused && section.objective && (
                  <p className="break-words">
                    <span className="text-foreground">Objective: </span>
                    {section.objective}
                  </p>
                )}
                {section.resourceUrl && (
                  <a
                    className="inline-flex min-h-11 items-center text-accent-hover underline"
                    href={section.resourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Module resource ↗
                  </a>
                )}
              </div>
            )}
            {section.steps.map((step) => (
              <div
                key={step.id}
                className={styles.step}
                data-status={step.status}
              >
                <button
                  className="flex size-11 shrink-0 items-center justify-center rounded-lg text-success hover:bg-elevated disabled:opacity-40"
                  disabled={busy || m.archived || section.archived}
                  aria-label={`${step.completed ? "Undo" : "Complete"} ${step.title}`}
                  aria-pressed={step.completed}
                  onClick={() =>
                    onChange({
                      kind: "complete",
                      id: step.id,
                      completed: !step.completed,
                    })
                  }
                >
                  {step.completed ? (
                    <Check size={17} />
                  ) : (
                    <span aria-hidden="true">○</span>
                  )}
                </button>
                <button
                  onClick={() => onSelect(step.id)}
                  className="min-h-11 min-w-0 flex-1 py-2 text-left hover:text-accent-hover"
                >
                  <span className="block break-words text-sm">
                    {step.title}
                  </span>
                  <span
                    className={`mt-1 block text-xs ${step.status === "needs_review" ? "text-warning" : "text-muted"}`}
                  >
                    {stepStatusNames[step.status]} ·{" "}
                    {formatTime(history, step.id)}
                    {step.id === m.currentStepId ? " · Current" : ""}
                  </span>
                </button>
              </div>
            ))}
            {!section.steps.length && (
              <p className="px-4 py-3 text-xs text-muted">
                No steps yet. Add an outcome you want to learn.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-1 border-t border-border px-3 py-2">
              <Button
                variant="ghost"
                disabled={busy || m.archived || section.archived}
                onClick={() => onAdd(section)}
              >
                Add step
              </Button>
              <details>
                <summary className="flex min-h-11 cursor-pointer items-center gap-1 px-2 text-xs text-muted">
                  <MoreHorizontal size={16} />
                  Module actions
                </summary>
                <div className="flex flex-wrap gap-1">
                  <Button
                    variant="ghost"
                    disabled={busy || m.archived || section.archived}
                    onClick={() => onEdit(section)}
                  >
                    Edit module
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={busy || m.archived || section.archived}
                    onClick={() => onRemove(section.id, section.title, false)}
                  >
                    Delete module
                  </Button>
                  <Button
                    variant="ghost"
                    aria-label={`Move ${section.title} up`}
                    disabled={
                      busy || m.archived || section.archived || index === 0
                    }
                    onClick={() =>
                      onMove(
                        m.sections.map((s) => s.id),
                        index,
                        -1,
                        null,
                      )
                    }
                  >
                    <ArrowUp size={15} />
                  </Button>
                  <Button
                    variant="ghost"
                    aria-label={`Move ${section.title} down`}
                    disabled={
                      busy ||
                      m.archived ||
                      section.archived ||
                      index === m.sections.length - 1
                    }
                    onClick={() =>
                      onMove(
                        m.sections.map((s) => s.id),
                        index,
                        1,
                        null,
                      )
                    }
                  >
                    <ArrowDown size={15} />
                  </Button>
                </div>
              </details>
            </div>
          </details>
        );
      })}
    </div>
  );
}
import { formatDuration } from "@/lib/dates";
function formatTime(history: StudyHistory[], id: string) {
  return formatDuration(stepStudyTime(history, id));
}
