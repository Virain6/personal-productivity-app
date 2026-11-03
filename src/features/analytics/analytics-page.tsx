"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowUpRight,
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CircleCheck,
  BookOpen,
  Layers3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlannerQuery } from "@/lib/use-planner-query";
import { formatDuration } from "@/lib/dates";
import {
  presetRange,
  rangeError,
  shiftRange,
  type RangePreset,
} from "@/lib/analytics-range";
import { roadmapColor } from "@/lib/roadmap-colors";
import type { AnalyticsData, AnalyticsRange } from "@/lib/analytics-types";
import { HabitReport } from "./habit-report";
import { LearningActivity } from "./learning-activity";
import styles from "./analytics.module.css";
const TimeChart = dynamic(
  () => import("./time-chart").then((m) => m.TimeChart),
  {
    loading: () => (
      <div className={styles.chart} role="status">
        Loading chart…
      </div>
    ),
  },
);
export function AnalyticsPage() {
  const [chosenRange, setRange] = useState<AnalyticsRange | null>(null);
  const [preset, setPreset] = useState<RangePreset>("week");
  const [draft, setDraft] = useState<AnalyticsRange | null>(null);
  const [validation, setValidation] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const url = `/api/planner?view=analytics${chosenRange ? `&from=${chosenRange.from}&to=${chosenRange.to}` : ""}`;
  const { data, error, reload } = usePlannerQuery<AnalyticsData>(url);
  const range = chosenRange ?? data?.range;
  const selectPreset = (value: Exclude<RangePreset, "custom">) => {
    if (!data) return;
    setPreset(value);
    setRange(presetRange(value, data.today));
    setDraft(null);
    setValidation("");
  };
  const currentMap = data?.roadmaps.find((r) => r.id === selected);
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>A little perspective</p>
          <h1>Analytics</h1>
          <p className={styles.subtitle}>
            See where your time goes, and how your learning is taking shape.
          </p>
        </div>
        <ChartNoAxesCombined
          size={28}
          aria-hidden="true"
          className={styles.headerIcon}
        />
      </header>
      <section aria-label="Analytics date range" className={styles.controls}>
        <div className={styles.presets}>
          {(
            [
              ["week", "This week"],
              ["lastWeek", "Last week"],
              ["month", "This month"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              disabled={!data}
              aria-pressed={Boolean(
                data &&
                preset !== "custom" &&
                range?.from === presetRange(value, data.today).from &&
                range?.to === presetRange(value, data.today).to,
              )}
              variant={
                data &&
                preset !== "custom" &&
                range?.from === presetRange(value, data.today).from &&
                range?.to === presetRange(value, data.today).to
                  ? "primary"
                  : "ghost"
              }
              onClick={() => selectPreset(value)}
            >
              {label}
            </Button>
          ))}
          <Button
            aria-pressed={preset === "custom"}
            variant={preset === "custom" ? "primary" : "ghost"}
            onClick={() => {
              setPreset("custom");
              setDraft(range ?? null);
            }}
            disabled={!data}
          >
            Custom
          </Button>
        </div>
        {range && (
          <div className={styles.range}>
            <Button
              aria-label="Previous period"
              disabled={!data}
              onClick={() => {
                const next = shiftRange(range, preset, -1);
                setRange(next);
                setDraft(next);
              }}
            >
              <ChevronLeft size={16} />
            </Button>
            <span>
              {range.from} <span className="text-muted">—</span> {range.to}
            </span>
            <Button
              aria-label="Next period"
              disabled={!data}
              onClick={() => {
                const next = shiftRange(range, preset, 1);
                setRange(next);
                setDraft(next);
              }}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        )}
        {preset === "custom" && range && (
          <form
            className={styles.custom}
            onSubmit={(e) => {
              e.preventDefault();
              const next = draft ?? range;
              const message = rangeError(next);
              setValidation(message);
              if (!message) setRange(next);
            }}
          >
            <label>
              From
              <input
                type="date"
                required
                value={draft?.from ?? range.from}
                onChange={(e) =>
                  setDraft({ ...(draft ?? range), from: e.target.value })
                }
              />
            </label>
            <label>
              Through
              <input
                type="date"
                required
                value={draft?.to ?? range.to}
                onChange={(e) =>
                  setDraft({ ...(draft ?? range), to: e.target.value })
                }
              />
            </label>
            <Button type="submit" disabled={!data}>
              Apply range
            </Button>
            <span className={styles.hint}>Up to 93 days</span>
          </form>
        )}
        {validation && (
          <p role="alert" className="text-danger">
            {validation}
          </p>
        )}
      </section>
      {error && (
        <div role="alert" className={styles.notice}>
          <p>
            {error} {data && "Showing the last loaded values."}
          </p>
          <Button onClick={reload}>Retry</Button>
        </div>
      )}
      {!data && !error && (
        <div role="status" className={styles.loading}>
          Loading your activity…
        </div>
      )}
      {data && (
        <>
          <p className={styles.context}>
            {data.timezone} · Saved sessions only
            {data.range.to >= data.today
              ? " · Current period is still in progress"
              : ""}
          </p>
          <section className={styles.stats} aria-label="Period summary">
            <article>
              <BookOpen size={17} />
              <h2>Study time</h2>
              <strong>{formatDuration(data.summary.studyMs)}</strong>
              <p>
                {data.previous?.hasStudy
                  ? `${formatDuration(data.previous.studyMs)} in the comparison period`
                  : "Linked to your roadmaps"}
              </p>
            </article>
            <article>
              <Clock3 size={17} />
              <h2>All tracked time</h2>
              <strong>{formatDuration(data.summary.trackedMs)}</strong>
              <p>Study and other saved activity</p>
            </article>
            <article>
              <CircleCheck size={17} />
              <h2>Tasks completed</h2>
              <strong>
                {data.summary.completedTasks}
                <small>
                  {data.summary.completionRate === null
                    ? "No required tasks"
                    : `${Math.round(data.summary.completionRate)}% required completion`}
                </small>
              </strong>
              <p>
                {data.summary.completedRequired} of {data.summary.requiredTasks}{" "}
                required through today
              </p>
            </article>
            <article>
              <Layers3 size={17} />
              <h2>Study sessions</h2>
              <strong>{data.summary.studySessions}</strong>
              <p>Saved sessions started in this period</p>
            </article>
          </section>
          {data.previous && (
            <p className={styles.context}>
              Comparison: {data.previous.from} — {data.previous.to}
              {data.range.to > data.today ? " (matching elapsed days)" : ""}. No
              percentage change is inferred from an empty period.
            </p>
          )}
          {!data.summary.trackedMs && (
            <div className={styles.empty}>
              <Clock3 size={22} aria-hidden="true" />
              <div>
                <h2>No saved time in this period</h2>
                <p>
                  Start a timer or record time from Home or Learning. Charts
                  will use those saved sessions.
                </p>
                <Link href="/learning">
                  Open Learning <ArrowUpRight size={14} />
                </Link>
              </div>
            </div>
          )}
          <div className={styles.mainGrid}>
            <section
              className={styles.panel}
              aria-labelledby="study-chart-title"
            >
              <div className={styles.panelHeader}>
                <div>
                  <h2 id="study-chart-title">Your study rhythm</h2>
                  <p>Recorded time, day by day</p>
                </div>
                <span className={styles.bigValue}>
                  {formatDuration(data.summary.studyMs)}
                </span>
              </div>
              <TimeChart rows={data.days} />
            </section>
            <section
              className={styles.panel}
              aria-labelledby="roadmap-chart-title"
            >
              <div className={styles.panelHeader}>
                <div>
                  <h2 id="roadmap-chart-title">Time by roadmap</h2>
                  <p>Select a roadmap for activity, progress and modules</p>
                </div>
              </div>
              {data.roadmaps.length ? (
                <div className={styles.roadmaps}>
                  {data.roadmaps.map((map) => (
                    <button
                      key={map.id}
                      className={styles.roadmap}
                      aria-pressed={selected === map.id}
                      onClick={() =>
                        setSelected(selected === map.id ? null : map.id)
                      }
                    >
                      <span className={styles.mapLabel}>
                        <span>
                          <i style={{ background: roadmapColor(map.color) }} />
                          {map.title}
                          {map.archived && <small>Archived</small>}
                        </span>
                        <b>{formatDuration(map.studyMs)}</b>
                      </span>
                      <span className={styles.track}>
                        <span
                          style={{
                            width: `${data.summary.studyMs ? (map.studyMs / data.summary.studyMs) * 100 : 0}%`,
                            background: roadmapColor(map.color),
                          }}
                        />
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className={styles.noData}>
                  Create a roadmap and link a study session to see its time
                  here.
                </p>
              )}
              <p className={styles.hint}>
                Bars show each roadmap’s share of recorded study time. Archived
                history stays visible.
              </p>
            </section>
          </div>
          {currentMap && (
            <section
              className={styles.panel}
              aria-label={`${currentMap.title} study details`}
            >
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.eyebrow}>
                    Roadmap detail · Selected period
                  </p>
                  <h2>{currentMap.title}</h2>
                  <p>
                    {formatDuration(currentMap.studyMs)} · {currentMap.sessions}{" "}
                    sessions started ·{" "}
                    {currentMap.lastStudied
                      ? `Last studied ${currentMap.lastStudied}`
                      : "No recorded study in this period"}
                  </p>
                </div>
                <Link
                  className={styles.openLink}
                  href={`/learning/${currentMap.id}`}
                >
                  Open roadmap <ArrowUpRight size={15} />
                </Link>
              </div>
              <LearningActivity roadmap={currentMap} />
              <div className={styles.modules}>
                {currentMap.modules.map((module) => (
                  <Link
                    key={module.id}
                    href={
                      module.archived
                        ? `/learning/${currentMap.id}`
                        : `/learning/${currentMap.id}/modules/${module.id}`
                    }
                  >
                    <div>
                      <span>{module.title}</span>
                      {module.archived && <small>Archived</small>}
                      <p>
                        {module.completed}/{module.steps} steps completed ·
                        Current mastery
                      </p>
                    </div>
                    <strong>{formatDuration(module.studyMs)}</strong>
                  </Link>
                ))}
              </div>
              <p className={styles.hint}>
                Time without a module:{" "}
                {formatDuration(
                  Math.max(
                    0,
                    currentMap.studyMs -
                      currentMap.modules.reduce((n, m) => n + m.studyMs, 0),
                  ),
                )}
                . Mastery reflects current step status, independently of this
                date range and recorded hours.
              </p>
            </section>
          )}
          <div className={styles.mainGrid}>
            <section
              className={styles.panel}
              aria-labelledby="planned-chart-title"
            >
              <div className={styles.panelHeader}>
                <div>
                  <h2 id="planned-chart-title">Planned & recorded</h2>
                  <p>Roadmap activities and actual saved study time</p>
                </div>
              </div>
              <div className={styles.legend}>
                <span>
                  <i style={{ background: "#606271" }} />
                  Planned {formatDuration(data.summary.plannedMs)}
                </span>
                <span>
                  <i style={{ background: "var(--accent-hover)" }} />
                  Recorded {formatDuration(data.summary.studyMs)}
                </span>
              </div>
              <TimeChart rows={data.days} planned />
              <div className={styles.statuses}>
                {Object.entries(data.summary.studyTasks).map(([key, value]) => (
                  <span key={key}>
                    <b>{value}</b>{" "}
                    {key === "missed"
                      ? "unfinished past"
                      : key === "open"
                        ? "open"
                        : key}
                  </span>
                ))}
              </div>
              <p className={styles.hint}>
                Completion is a task status, never proof of recorded time.
                Future activities remain planned.
              </p>
            </section>
            <section
              className={styles.panel}
              aria-labelledby="trend-chart-title"
            >
              <div className={styles.panelHeader}>
                <div>
                  <h2 id="trend-chart-title">The longer view</h2>
                  <p>Eight Monday-start weeks ending with this period</p>
                </div>
              </div>
              <TimeChart rows={data.trend} weekly />
              <p className={styles.hint}>
                Zero means no saved study time. The final week stops at the
                selected end date; current and future weeks may be incomplete.
              </p>
            </section>
          </div>
          <HabitReport habits={data.habits} />
          <details className={styles.method}>
            <summary>How these numbers are calculated</summary>
            <ul>
              <li>
                Study time comes from saved sessions linked to a roadmap.
                Unlinked time appears only in All tracked time. Running timers
                are excluded until stopped.
              </li>
              <li>
                Time crossing midnight is split using {data.timezone}, including
                daylight-saving changes. Session counts use the local start
                date, so a carry-over session can add time without adding a
                session count.
              </li>
              <li>
                Each saved timer or manual record is counted once. Deliberately
                confirmed overlapping records both contribute their saved
                durations.
              </li>
              <li>
                Required completion excludes optional and future tasks. Skipped
                required tasks remain in the denominator. Task status is
                current, grouped by planned date, not the date it was checked
                off.
              </li>
              <li>
                Planned study uses roadmap-owned calendar occurrences, including
                one-offs. Cancelled and retired occurrences are excluded. Older
                unlinked activity is not guessed to be study.
              </li>
              <li>
                Previous-period comparisons require saved records and match the
                elapsed number of days for an unfinished period. No mastery or
                successful habit days are inferred from time.
              </li>
            </ul>
          </details>
        </>
      )}
    </div>
  );
}
