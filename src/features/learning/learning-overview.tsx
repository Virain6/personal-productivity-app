"use client";
import { useState } from "react";
import Link from "next/link";
import { BookOpen, ArrowUpRight, Clock3, Search } from "lucide-react";
import { roadmapStyle } from "@/lib/roadmap-colors";
import { Button } from "@/components/ui/button";
import {
  roadmapProgress,
  type LearningData,
  filterRoadmaps,
  learningSummary,
} from "@/lib/learning-types";
import { formatDuration } from "@/lib/dates";
import styles from "./learning.module.css";
export function RoadmapMark() {
  return (
    <span className={styles.categoryMark}>
      <BookOpen size={19} aria-hidden="true" />
    </span>
  );
}
export function LearningOverview({
  data,
  onCreate,
}: {
  data: LearningData;
  onCreate: () => void;
}) {
  const [query, setQuery] = useState("");
  const active = data.roadmaps.filter((m) => !m.archived);
  const shown = filterRoadmaps(data.roadmaps, query, "");
  const { completed, studiedMs } = learningSummary(data);
  return (
    <div className={styles.workspace}>
      <div className={styles.stats} aria-label="Learning summary">
        <div>
          <span>Active roadmaps</span>
          <strong>{active.length}</strong>
        </div>
        <div>
          <span>Linked study time</span>
          <strong>{formatDuration(studiedMs)}</strong>
        </div>
        <div>
          <span>Completed steps · active</span>
          <strong>{completed}</strong>
        </div>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-medium">Your roadmaps</h2>
          <p className="mt-1 text-xs text-muted">
            Choose your focus. Progress at your own pace.
          </p>
        </div>
        {active.length > 1 && (
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Search roadmaps</span>
              <span className="relative block">
                <Search
                  size={15}
                  aria-hidden="true"
                  className="absolute right-3 top-4 text-muted"
                />
                <input
                  placeholder="Search roadmaps"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </span>
            </label>
          </div>
        )}
      </div>
      {shown.length === 0 && (
        <div className={styles.empty}>
          <BookOpen size={26} aria-hidden="true" />
          <h3 className="font-medium">
            {active.length
              ? "No matching roadmaps"
              : "Make room for your next subject"}
          </h3>
          <p className="text-sm text-muted">
            {active.length
              ? "Try another search term."
              : "Create a roadmap, organize its modules, and choose a first step."}
          </p>
          {active.length ? (
            <Button
              onClick={() => {
                setQuery("");
              }}
            >
              Clear filters
            </Button>
          ) : (
            <Button onClick={onCreate}>Create Roadmap</Button>
          )}
        </div>
      )}
      <div className={styles.grid}>
        {shown.map((m) => {
          const progress = roadmapProgress(m.sections),
            current = m.sections
              .filter((s) => !s.archived)
              .flatMap((s) => s.steps)
              .find((s) => s.id === m.currentStepId);
          const time = data.studyHistory
            .filter((s) => s.roadmapId === m.id && s.endedAt !== null)
            .reduce((n, s) => n + s.endedAt! - s.startedAt, 0);
          return (
            <article
              key={m.id}
              className={styles.card}
              style={roadmapStyle(m.color)}
            >
              <div className="flex items-center gap-3">
                <RoadmapMark />
              </div>
              <h3 className="break-words text-lg font-semibold">
                <Link
                  href={`/learning/${m.id}`}
                  className="hover:text-accent-hover"
                >
                  {m.title}
                </Link>
              </h3>
              {m.description && (
                <p className="line-clamp-2 text-sm text-muted">
                  {m.description}
                </p>
              )}
              <div>
                <div className="mb-2 flex justify-between text-xs">
                  <span className="text-muted">
                    {progress.completed} / {progress.total} steps
                  </span>
                  <span>{Math.round(progress.percent)}%</span>
                </div>
                <progress
                  value={progress.percent}
                  max={100}
                  aria-label={`${m.title} progress`}
                  className={styles.progress}
                />
              </div>
              <dl className="space-y-2 text-xs">
                <div>
                  <dt className="text-muted">Current focus</dt>
                  <dd className="mt-1 truncate">
                    {current?.title ?? "Choose a topic"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Up next</dt>
                  <dd className="mt-1 truncate">
                    {progress.next?.title ??
                      (progress.total
                        ? "All steps completed"
                        : "Add your first step")}
                  </dd>
                </div>
              </dl>
              <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
                <span className="flex items-center gap-1 text-xs text-muted">
                  <Clock3 size={13} aria-hidden="true" />
                  {formatDuration(time)}
                </span>
                <Link
                  className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-accent-hover"
                  href={`/learning/${m.id}`}
                >
                  Continue learning
                  <ArrowUpRight size={15} aria-hidden="true" />
                </Link>
              </div>
            </article>
          );
        })}
      </div>
      <p className="text-xs text-muted">
        Study time uses saved, linked sessions, including archived roadmaps.
        Mastery changes only when you update a step.
      </p>
      <details className="rounded-xl border border-border p-3">
        <summary className="min-h-11 cursor-pointer py-3 text-sm">
          Archived roadmaps ({data.roadmaps.filter((m) => m.archived).length})
        </summary>
        {data.roadmaps
          .filter((m) => m.archived)
          .map((m) => (
            <Link
              key={m.id}
              className="block min-h-11 py-3 text-sm text-muted hover:text-foreground"
              href={`/learning/${m.id}`}
            >
              {m.title}
            </Link>
          ))}
      </details>
    </div>
  );
}
