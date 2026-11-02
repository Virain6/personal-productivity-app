"use client";
import { roadmapColors, roadmapStyle } from "@/lib/roadmap-colors";
import { ModuleWorkspace } from "./module-workspace";
import { LearningOverview, RoadmapMark } from "./learning-overview";
import { RoadmapPath } from "./roadmap-path";
import styles from "./learning.module.css";
import { StepPanel } from "./step-panel";
import { DateTime } from "luxon";
import { useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { usePlannerQuery } from "@/lib/use-planner-query";
import { sendCommand } from "@/lib/api";
import { formatDuration } from "@/lib/dates";
import {
  roadmapProgress,
  type LearningData,
  type Roadmap,
} from "@/lib/learning-types";
type Editor = {
  label: string;
  command: Record<string, unknown>;
  operation?: Record<string, unknown>;
  title: string;
  resourceUrl?: string;
  color?: string;
  confirm?: boolean;
  description?: string;
  objective?: string;
  goal?: string;
  targetDate?: string;
  days?: number[];
  minutes?: number;
  time?: string;
};
export function LearningPage({
  roadmapId,
  moduleId,
}: {
  roadmapId?: string;
  moduleId?: string;
}) {
  const { data, error, reload } = usePlannerQuery<LearningData>(
    "/api/planner?view=learning",
  );
  const [selectedStep, setSelectedStep] = useState<string | null>(null);
  const history = (data?.studyHistory ?? []).filter(
    (s) => !moduleId || s.sectionId === moduleId,
  );
  const [editor, setEditor] = useState<Editor | null>(null),
    [saveError, setSaveError] = useState(""),
    [busy, setBusy] = useState(false);
  const gate = useRef(false);
  const [retry, setRetry] = useState<Record<string, unknown> | null>(null);
  async function save(command: Record<string, unknown>) {
    if (gate.current) return;
    gate.current = true;
    setBusy(true);
    setSaveError("");
    try {
      await sendCommand(command);
      setEditor(null);
      setRetry(null);
      reload();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save.");
      setRetry(command);
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  function change(m: Roadmap, operation: Record<string, unknown>) {
    return { action: "roadmapChange", id: m.id, version: m.version, operation };
  }
  function edit(
    m: Roadmap,
    operation: Record<string, unknown>,
    label: string,
    title = "",
    resourceUrl?: string,
    metadata: Partial<Editor> = {},
  ) {
    setSaveError("");
    setRetry(null);
    setEditor({
      label,
      command: { action: "roadmapChange", id: m.id, version: m.version },
      operation,
      title,
      resourceUrl,
      ...metadata,
    });
  }
  function remove(
    m: Roadmap,
    operation: Record<string, unknown>,
    title: string,
  ) {
    setEditor({
      label: "Delete " + title,
      command: change(m, operation),
      title,
      confirm: true,
    });
    setSaveError("");
    setRetry(null);
  }
  function move(
    m: Roadmap,
    ids: string[],
    index: number,
    delta: number,
    sectionId: string | null,
  ) {
    const next = [...ids];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    void save(change(m, { kind: "reorder", sectionId, ids: next }));
  }
  const m = data?.roadmaps.find((r) => r.id === roadmapId);
  const selectedSection = m?.sections.find((s) =>
    s.steps.some((step) => step.id === selectedStep),
  );
  const selected = selectedSection?.steps.find(
    (step) => step.id === selectedStep,
  );
  function createRoadmap() {
    setSaveError("");
    setRetry(null);
    setEditor({
      label: "Create Roadmap",
      command: { action: "roadmapCreate" },
      title: "",
      color: "purple",
      days: [],
      minutes: 60,
      time: "",
      description: "",
      goal: "",
      targetDate: "",
    });
  }
  const currentModule = m?.sections.find((s) => s.id === moduleId);
  const visibleMap =
    m && currentModule ? { ...m, sections: [currentModule] } : m;
  const progress = roadmapProgress(
    currentModule
      ? [{ ...currentModule, archived: false }]
      : (visibleMap?.sections ?? []),
  );
  const recommended =
    currentModule?.steps.find((s) => s.id === m?.currentStepId) ??
    progress.next;
  const buttonClass =
    "min-h-11 rounded-md px-2 text-xs text-muted hover:bg-elevated disabled:opacity-40";
  const content = (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">
          {moduleId
            ? (currentModule?.title ?? "Module")
            : roadmapId
              ? (m?.title ?? "Roadmap")
              : "Learning"}
        </h1>
        {roadmapId ? (
          <Link
            className={buttonClass}
            href={moduleId ? `/learning/${roadmapId}` : "/learning"}
          >
            {moduleId ? (m?.title ?? "Roadmap") : "All roadmaps"}
          </Link>
        ) : (
          <Button variant="primary" onClick={createRoadmap}>
            Create Roadmap
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-danger">
          {error} <Button onClick={reload}>Retry loading</Button>
        </p>
      )}
      {!data && !error && <p role="status">Loading learning roadmaps…</p>}
      {!editor && saveError && (
        <div role="alert" className="text-danger">
          {saveError}
          <Button disabled={busy} onClick={() => retry && void save(retry)}>
            Retry save
          </Button>
          <Button
            onClick={() => {
              setSaveError("");
              setRetry(null);
              reload();
            }}
          >
            Reload latest
          </Button>
        </div>
      )}
      {data && !roadmapId && (
        <LearningOverview data={data} onCreate={createRoadmap} />
      )}
      {data && roadmapId && !m && (
        <p>
          Roadmap not found. <Link href="/learning">Return to Learning</Link>
        </p>
      )}
      {moduleId && m && !currentModule && <p>Module not found.</p>}
      {m && (!moduleId || currentModule) && (
        <div style={roadmapStyle(m.color)}>
          <div className="mb-4 flex items-start gap-3">
            <RoadmapMark />
            <div className="min-w-0">
              <p className="whitespace-pre-wrap break-words text-sm text-muted">
                {currentModule?.description ?? m.description}
              </p>
              {(currentModule?.objective ?? m.goal) && (
                <p className="mt-2 break-words text-sm">
                  <span className="text-muted">Goal: </span>
                  {currentModule?.objective ?? m.goal}
                </p>
              )}
              {!moduleId && m.targetDate && (
                <p className="mt-2 text-xs text-muted">
                  Target · {m.targetDate}
                </p>
              )}
            </div>
          </div>
          <p className="text-xs text-muted">
            {progress.completed}/{progress.total} steps complete
            {m.archived || currentModule?.archived ? " · Archived" : ""}
            {currentModule && !currentModule.archived
              ? ` · ${progress.total && progress.completed === progress.total ? "Completed" : currentModule.steps.some((s) => s.status === "needs_review") ? "Needs review" : currentModule.steps.some((s) => s.status === "in_progress" || s.completed) ? "In progress" : "Not started"}`
              : ""}
          </p>
          <progress
            aria-label={moduleId ? "Module progress" : "Roadmap progress"}
            value={progress.percent}
            max={100}
            className={`${styles.progress} my-2`}
          />
          <p className="mb-2 text-sm">
            Next:{" "}
            {progress.next?.title ??
              (progress.total
                ? "All steps complete"
                : "Add a section and learning steps")}
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            {recommended && (
              <Button
                variant="primary"
                disabled={busy || m.archived || currentModule?.archived}
                onClick={() => setSelectedStep(recommended.id)}
              >
                Start studying
              </Button>
            )}
            {currentModule && (
              <>
                <Button
                  disabled={busy || m.archived || currentModule.archived}
                  onClick={() =>
                    edit(
                      m,
                      { kind: "sectionEdit", id: currentModule.id },
                      "Edit module",
                      currentModule.title,
                      currentModule.resourceUrl,
                      {
                        description: currentModule.description,
                        objective: currentModule.objective,
                      },
                    )
                  }
                >
                  Edit module
                </Button>
                <Button
                  disabled={busy || m.archived}
                  onClick={() =>
                    void save(
                      change(m, {
                        kind: "sectionArchive",
                        id: currentModule.id,
                        archived: !currentModule.archived,
                      }),
                    )
                  }
                >
                  {currentModule.archived ? "Restore module" : "Archive module"}
                </Button>
              </>
            )}
            {!moduleId && (
              <>
                <Button
                  disabled={busy}
                  onClick={() =>
                    setEditor({
                      label: "Edit roadmap",
                      command: {
                        action: "roadmapChange",
                        id: m.id,
                        version: m.version,
                      },
                      operation: { kind: "edit" },
                      title: m.title,
                      color: m.color,
                      description: m.description,
                      goal: m.goal,
                      targetDate: m.targetDate ?? "",
                    })
                  }
                >
                  Edit roadmap
                </Button>
                <Button
                  disabled={busy || m.archived}
                  onClick={() =>
                    edit(m, { kind: "sectionAdd" }, "Add module", "", "", {
                      description: "",
                      objective: "",
                    })
                  }
                >
                  Add module
                </Button>
                <Button
                  disabled={busy}
                  onClick={() =>
                    void save(
                      change(m, { kind: "archive", archived: !m.archived }),
                    )
                  }
                >
                  {m.archived ? "Restore" : "Archive"}
                </Button>
              </>
            )}
            {m.currentStepId && (
              <Button
                disabled={busy || m.archived}
                onClick={() =>
                  void save(change(m, { kind: "current", id: null }))
                }
              >
                Clear current topic
              </Button>
            )}
          </div>
          <div className="space-y-2">
            <details className="rounded-lg border border-border p-3">
              <summary className="min-h-11 cursor-pointer py-3 text-sm">
                Study history ·{" "}
                {formatDuration(
                  history
                    .filter((s) => s.roadmapId === m.id && s.endedAt !== null)
                    .reduce((n, s) => n + s.endedAt! - s.startedAt, 0),
                )}
              </summary>
              <p className="mb-2 text-xs text-muted">
                Saved topic labels are preserved. Running sessions are excluded
                from totals. Edit links and time through the activity&apos;s
                Home details.
              </p>
              {history.filter((s) => s.roadmapId === m.id).length === 0 && (
                <p className="text-xs text-muted">No linked sessions yet.</p>
              )}
              <ul className="space-y-2">
                {history
                  .filter((s) => s.roadmapId === m.id)
                  .map((s) => (
                    <li key={s.sessionId} className="break-words text-xs">
                      <span className="text-muted">
                        {DateTime.fromMillis(s.startedAt, {
                          zone: data?.timezone ?? "America/Toronto",
                        }).toFormat("MMM d, yyyy HH:mm ZZ")}{" "}
                        ·{" "}
                        {s.endedAt === null
                          ? "Running"
                          : formatDuration(s.endedAt - s.startedAt)}
                      </span>
                      <p>
                        {s.sectionTitle} / {s.stepTitle}
                      </p>
                      {s.summary && <p className="text-muted">{s.summary}</p>}
                    </li>
                  ))}
              </ul>
            </details>
            <RoadmapPath
              focused={Boolean(moduleId)}
              roadmap={visibleMap!}
              history={history}
              busy={busy}
              onSelect={setSelectedStep}
              onChange={(o) => void save(change(m, o))}
              onAdd={(section) =>
                edit(
                  m,
                  { kind: "stepAdd", sectionId: section.id },
                  "Add learning step",
                  "",
                  "",
                  { description: "", objective: "" },
                )
              }
              onEdit={(section) =>
                edit(
                  m,
                  { kind: "sectionEdit", id: section.id },
                  "Edit module",
                  section.title,
                  section.resourceUrl,
                  {
                    description: section.description,
                    objective: section.objective,
                  },
                )
              }
              onRemove={(id, title, isStep) =>
                remove(
                  m,
                  { kind: isStep ? "stepDelete" : "sectionDelete", id },
                  title,
                )
              }
              onMove={(ids, index, delta, sectionId) =>
                move(m, ids, index, delta, sectionId)
              }
            />
            {!m.sections.length && (
              <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted">
                Your path starts here. Add a module, then the steps you want to
                learn.
              </p>
            )}
          </div>
        </div>
      )}
      {data && m && selected && selectedSection && !editor && (
        <StepPanel
          key={selected.id}
          data={data}
          roadmap={{ ...m, archived: m.archived || selectedSection.archived }}
          section={selectedSection}
          step={selected}
          busy={busy}
          notice={
            saveError && (
              <div role="alert" className="text-sm text-danger">
                {saveError}
                <Button
                  disabled={busy}
                  onClick={() => retry && void save(retry)}
                >
                  Retry save
                </Button>
                <Button
                  onClick={() => {
                    setSaveError("");
                    setRetry(null);
                    reload();
                  }}
                >
                  Reload latest
                </Button>
              </div>
            )
          }
          onClose={() => setSelectedStep(null)}
          onChange={(o) => void save(change(m, o))}
          onEdit={() =>
            edit(
              m,
              { kind: "stepEdit", id: selected.id },
              "Edit learning step",
              selected.title,
              selected.resourceUrl,
              {
                description: selected.description,
                objective: selected.objective,
              },
            )
          }
          onRemove={() => {
            setSelectedStep(null);
            remove(m, { kind: "stepDelete", id: selected.id }, selected.title);
          }}
          onMove={(delta) =>
            move(
              m,
              selectedSection.steps.map((s) => s.id),
              selectedSection.steps.findIndex((s) => s.id === selected.id),
              delta,
              selectedSection.id,
            )
          }
        />
      )}
      {editor && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !busy && window.confirm("Discard this open edit?")) {
              setEditor(null);
              setSaveError("");
              setRetry(null);
            }
          }}
          title={editor.label}
          description={
            editor.confirm
              ? "This removes the item from the active roadmap. Stored records are retained for history."
              : "Progress changes only when you explicitly mark a learning step complete."
          }
        >
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fields = editor.confirm
                ? {}
                : {
                    title: editor.title,
                    ...(editor.description !== undefined
                      ? { description: editor.description }
                      : {}),
                    ...(editor.objective !== undefined
                      ? { objective: editor.objective }
                      : {}),
                    ...(editor.goal !== undefined
                      ? {
                          goal: editor.goal,
                          targetDate: editor.targetDate || null,
                        }
                      : {}),
                    ...(editor.color ? { color: editor.color } : {}),
                    ...(editor.days?.length
                      ? {
                          schedule: {
                            weekdays: editor.days,
                            minutes: editor.minutes ?? 60,
                            time:
                              String(
                                new FormData(e.currentTarget).get(
                                  "roadmapTime",
                                ) ?? "",
                              ) || null,
                            paused: false,
                            removed: false,
                          },
                        }
                      : {}),
                    ...(editor.resourceUrl !== undefined
                      ? { resourceUrl: editor.resourceUrl }
                      : {}),
                  };
              void save(
                editor.operation
                  ? {
                      ...editor.command,
                      operation: { ...editor.operation, ...fields },
                    }
                  : { ...editor.command, ...fields },
              );
            }}
          >
            {!editor.confirm && (
              <>
                <label className="block text-sm">
                  Title
                  <input
                    required
                    maxLength={160}
                    value={editor.title}
                    onChange={(e) =>
                      setEditor({ ...editor, title: e.target.value })
                    }
                  />
                </label>
                {editor.color !== undefined && (
                  <label className="block text-sm">
                    Accent color
                    <select
                      value={editor.color}
                      onChange={(e) =>
                        setEditor({ ...editor, color: e.target.value })
                      }
                    >
                      {Object.keys(roadmapColors).map((color) => (
                        <option key={color} value={color}>
                          {color[0].toUpperCase() + color.slice(1)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {editor.days !== undefined && (
                  <fieldset className="space-y-2">
                    <legend className="text-sm">
                      Weekly schedule (optional)
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                        (day, index) => (
                          <label
                            key={day}
                            className="flex min-h-11 items-center gap-1 text-xs"
                          >
                            <input
                              type="checkbox"
                              checked={editor.days!.includes(index + 1)}
                              onChange={(e) =>
                                setEditor({
                                  ...editor,
                                  days: e.target.checked
                                    ? [...editor.days!, index + 1].sort()
                                    : editor.days!.filter(
                                        (d) => d !== index + 1,
                                      ),
                                })
                              }
                            />
                            {day}
                          </label>
                        ),
                      )}
                    </div>
                    <p className="text-xs text-muted">
                      Leave all days unchecked to study only when you choose.
                    </p>
                    {editor.days.length > 0 && (
                      <>
                        <label>
                          Preferred duration (minutes)
                          <input
                            type="number"
                            required
                            min={1}
                            max={1440}
                            value={editor.minutes}
                            onChange={(e) =>
                              setEditor({
                                ...editor,
                                minutes: Number(e.target.value),
                              })
                            }
                          />
                        </label>
                        <label>
                          Suggested start (optional)
                          <input
                            name="roadmapTime"
                            type="time"
                            value={editor.time}
                            onChange={(e) =>
                              setEditor({ ...editor, time: e.target.value })
                            }
                          />
                        </label>
                      </>
                    )}
                  </fieldset>
                )}
                {editor.description !== undefined && (
                  <label>
                    Description
                    <textarea
                      rows={3}
                      maxLength={2000}
                      value={editor.description}
                      onChange={(e) =>
                        setEditor({ ...editor, description: e.target.value })
                      }
                    />
                  </label>
                )}
                {editor.objective !== undefined && (
                  <label>
                    Learning objective
                    <textarea
                      rows={2}
                      maxLength={500}
                      value={editor.objective}
                      onChange={(e) =>
                        setEditor({ ...editor, objective: e.target.value })
                      }
                    />
                  </label>
                )}
                {editor.goal !== undefined && (
                  <>
                    <label>
                      Learning goal
                      <textarea
                        rows={2}
                        maxLength={500}
                        value={editor.goal}
                        onChange={(e) =>
                          setEditor({ ...editor, goal: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Target date (optional)
                      <input
                        type="date"
                        value={editor.targetDate}
                        onChange={(e) =>
                          setEditor({ ...editor, targetDate: e.target.value })
                        }
                      />
                    </label>
                  </>
                )}
                {editor.resourceUrl !== undefined && (
                  <label className="block text-sm">
                    Resource URL (optional)
                    <input
                      type="url"
                      maxLength={2000}
                      value={editor.resourceUrl}
                      onChange={(e) =>
                        setEditor({ ...editor, resourceUrl: e.target.value })
                      }
                    />
                  </label>
                )}
              </>
            )}
            {saveError && (
              <p role="alert" className="text-danger">
                {saveError}
              </p>
            )}
            <Button
              type="submit"
              variant={editor.confirm ? "danger" : "primary"}
              disabled={busy}
            >
              {busy ? "Saving…" : editor.confirm ? "Delete" : "Save"}
            </Button>
            <Button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm("Discard this open edit?")) {
                  setEditor(null);
                  setSaveError("");
                  setRetry(null);
                }
              }}
            >
              Cancel
            </Button>
          </form>
        </Dialog>
      )}
    </>
  );
  return m && (!moduleId || currentModule) ? (
    <ModuleWorkspace roadmap={m} sectionId={moduleId ?? null}>
      {content}
    </ModuleWorkspace>
  ) : (
    content
  );
}
