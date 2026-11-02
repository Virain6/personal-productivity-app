"use client";
import { roadmapStyle } from "@/lib/roadmap-colors";
import { useRef, useState, type ReactNode } from "react";
import { DateTime } from "luxon";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { usePlannerQuery } from "@/lib/use-planner-query";
import { sendCommand } from "@/lib/api";
import { formatDuration, dayBounds } from "@/lib/dates";
import type {
  ModuleData,
  StudySchedule,
  StudyScheduleConfig,
} from "@/lib/module-types";
import type { Roadmap } from "@/lib/learning-types";
import styles from "./learning.module.css";
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export function ModuleWorkspace({
  roadmap,
  sectionId,
  children,
}: {
  roadmap: Roadmap;
  sectionId: string | null;
  children: ReactNode;
}) {
  const [month, setMonth] = useState("");
  const query = usePlannerQuery<ModuleData>(
    `/api/planner?view=module&roadmap=${roadmap.id}&module=${sectionId ?? ""}&month=${month}`,
  );
  const data = query.data;
  const [selected, setSelected] = useState("");
  const [editor, setEditor] = useState<{
    schedule?: StudySchedule;
    config: StudyScheduleConfig;
  } | null>(null);
  const [extra, setExtra] = useState<{
    stepId: string;
    date: string;
    minutes: number | undefined;
    additional: boolean;
    time: string;
  } | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const gate = useRef(false);
  const section = roadmap.sections.find((s) => s.id === sectionId),
    inactive = roadmap.archived || Boolean(section?.archived);
  const schedule = data?.schedules.find((s) => s.sectionId === sectionId);
  const steps = roadmap.sections
    .filter((s) => !s.archived && (!sectionId || s.id === sectionId))
    .flatMap((s) => s.steps);
  async function save(command: Record<string, unknown>) {
    if (gate.current) return;
    gate.current = true;
    setBusy(true);
    setError("");
    try {
      await sendCommand(command);
      setEditor(null);
      setExtra(null);
      query.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  function editSchedule() {
    setError("");
    setEditor({
      schedule,
      config: schedule?.config ?? {
        weekdays: [1],
        time: null,
        minutes: 60,
        paused: false,
        removed: false,
      },
    });
  }
  const selectedDay = data?.days.find(
    (d) => d.date === (selected || data.today),
  );
  return (
    <div className={styles.moduleLayout} style={roadmapStyle(roadmap.color)}>
      <div className="min-w-0">{children}</div>
      <aside
        className="min-w-0 space-y-4"
        aria-label={
          sectionId
            ? "Module study activity"
            : "Roadmap study schedule and activity"
        }
      >
        {query.error && (
          <p role="alert" className="text-danger">
            {query.error}
            <Button onClick={query.reload}>Retry</Button>
          </p>
        )}
        {!data && !query.error && <p role="status">Loading study activity…</p>}
        {data && (
          <>
            <section className={styles.sideCard}>
              <h2 className="mb-3 text-sm font-medium">Recorded study</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <strong className="text-xl font-medium">
                    {formatDuration(data.totals.studiedMs)}
                  </strong>
                  <p className="text-xs text-muted">Total time</p>
                </div>
                <div>
                  <strong className="text-xl font-medium">
                    {data.totals.sessions}
                  </strong>
                  <p className="text-xs text-muted">Saved sessions</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted">
                Last studied: {data.totals.lastStudied ?? "Not yet"}
              </p>
              <p className="mt-1 text-xs text-muted">
                Saved time is separate from mastery.
              </p>
            </section>
            {!sectionId && (
              <section className={styles.sideCard}>
                <h2 className="text-sm font-medium">
                  Overall roadmap schedule
                </h2>
                <p className="my-2 text-xs text-muted">
                  This is the only recurring study schedule for this roadmap. It
                  follows your current or next learning step.
                </p>
                {schedule && !schedule.config.removed ? (
                  <>
                    <p className="text-sm">
                      {schedule.config.weekdays
                        .map((d) => weekdays[d - 1])
                        .join(" · ")}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {schedule.config.time ?? "Any time"} ·{" "}
                      {schedule.config.minutes} min
                      {schedule.config.paused ? " · Paused" : ""}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted">No active schedule</p>
                )}
                <div className="mt-3 flex flex-wrap gap-1">
                  <Button disabled={busy || inactive} onClick={editSchedule}>
                    {schedule ? "Edit schedule" : "Set schedule"}
                  </Button>
                  {schedule && !schedule.config.removed && (
                    <>
                      <Button
                        disabled={busy || inactive}
                        onClick={() =>
                          void save({
                            action: "studyScheduleSave",
                            id: schedule.id,
                            version: schedule.version,
                            roadmapId: roadmap.id,
                            sectionId,
                            config: {
                              ...schedule.config,
                              paused: !schedule.config.paused,
                            },
                          })
                        }
                      >
                        {schedule.config.paused ? "Resume" : "Pause"}
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={busy || inactive}
                        onClick={() => {
                          setError("");
                          setEditor({
                            schedule,
                            config: { ...schedule.config, removed: true },
                          });
                        }}
                      >
                        Remove
                      </Button>
                    </>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted">
                  Changes apply from today. Past, edited, started and logged
                  occurrences are retained. Removing stops this schedule; it
                  retains its history.
                </p>
                <Button
                  disabled={busy || inactive}
                  onClick={() => {
                    setError("");
                    setExtra({
                      stepId: "",
                      additional: false,
                      date: data.today,
                      minutes: schedule?.config.minutes ?? 60,
                      time: schedule?.config.time ?? "",
                    });
                  }}
                >
                  <CalendarPlus size={14} />
                  Study Anytime
                </Button>
              </section>
            )}
            {sectionId && (
              <p className="text-sm text-muted">
                Modules organize learning; only the roadmap has a recurring
                schedule.{" "}
                <Link
                  className="text-accent-hover underline"
                  href={`/learning/${roadmap.id}`}
                >
                  Study or schedule this roadmap
                </Link>
                . Module activity below uses saved step-linked sessions.
              </p>
            )}
            <section
              className={styles.sideCard}
              aria-label="Monthly study activity"
            >
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  aria-label="Previous month"
                  onClick={() => {
                    setSelected("");
                    setMonth(
                      DateTime.fromISO(`${data.month}-01`)
                        .minus({ months: 1 })
                        .toFormat("yyyy-MM"),
                    );
                  }}
                >
                  <ChevronLeft size={16} />
                </Button>
                <h2 className="text-sm font-medium">
                  {DateTime.fromISO(`${data.month}-01`).toFormat("MMMM yyyy")}
                </h2>
                <Button
                  variant="ghost"
                  aria-label="Next month"
                  onClick={() => {
                    setSelected("");
                    setMonth(
                      DateTime.fromISO(`${data.month}-01`)
                        .plus({ months: 1 })
                        .toFormat("yyyy-MM"),
                    );
                  }}
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
              <div className={styles.monthGrid}>
                {weekdays.map((d) => (
                  <span
                    key={d}
                    className="py-2 text-center text-[10px] text-muted"
                  >
                    {d.slice(0, 1)}
                  </span>
                ))}
                {Array.from(
                  { length: DateTime.fromISO(`${data.month}-01`).weekday - 1 },
                  (_, i) => (
                    <span key={`blank-${i}`} />
                  ),
                )}
                {data.days.map((d) => (
                  <button
                    key={d.date}
                    className={styles.monthDay}
                    data-state={d.state}
                    aria-pressed={selectedDay?.date === d.date}
                    aria-label={`${d.date}: ${d.state}; ${d.scheduled} scheduled, ${d.completed} completed; ${formatDuration(d.studiedMs)} studied`}
                    onClick={() => setSelected(d.date)}
                  >
                    <span>{Number(d.date.slice(-2))}</span>
                    <span
                      className="block h-1.5 text-[9px] leading-none text-success"
                      aria-hidden="true"
                    >
                      {d.studiedMs > 0 ? "●" : ""}
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-muted">
                Teal: completed · Amber: missed · Accent: future · Dot: recorded
                study, including unscheduled days. Today is not missed.
              </p>
              {selectedDay && (
                <div className="mt-3 border-t border-border pt-3 text-xs">
                  <h3 className="font-medium">{selectedDay.date}</h3>
                  <p className="mt-1 text-muted">
                    {selectedDay.completed}/{selectedDay.scheduled} scheduled
                    sessions complete · {formatDuration(selectedDay.studiedMs)}{" "}
                    studied
                  </p>
                  {data.occurrences
                    .filter(
                      (t) => !t.cancelled && t.plannedDate === selectedDay.date,
                    )
                    .map((t) => (
                      <p className="mt-2 break-words" key={t.id}>
                        {t.title} · {t.status}
                      </p>
                    ))}
                  {data.history
                    .filter((s) => {
                      const [a, b] = dayBounds(selectedDay.date, data.timezone);
                      return (
                        s.endedAt !== null && s.startedAt < b && s.endedAt > a
                      );
                    })
                    .map((s) => (
                      <p key={s.id} className="mt-2 break-words text-muted">
                        {s.title || "Study session"} ·{" "}
                        {formatDuration(
                          Math.min(
                            dayBounds(selectedDay.date, data.timezone)[1],
                            s.endedAt!,
                          ) -
                            Math.max(
                              dayBounds(selectedDay.date, data.timezone)[0],
                              s.startedAt,
                            ),
                        )}
                      </p>
                    ))}
                </div>
              )}
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs">
                <div>
                  <dt className="text-muted">Sessions this month</dt>
                  <dd className="mt-1 text-base">{data.monthStats.sessions}</dd>
                </div>
                <div>
                  <dt className="text-muted">Study time</dt>
                  <dd className="mt-1 text-base">
                    {formatDuration(data.monthStats.studiedMs)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Scheduled completed</dt>
                  <dd className="mt-1 text-base">
                    {data.monthStats.completed}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Consistency</dt>
                  <dd className="mt-1 text-base">
                    {data.monthStats.consistency === null
                      ? "—"
                      : `${Math.round(data.monthStats.consistency)}%`}
                  </dd>
                </div>
              </dl>
              <p className="mt-2 text-[11px] text-muted">
                {data.monthStats.successfulDays}/{data.monthStats.eligibleDays}{" "}
                elapsed scheduled days fully complete. Excludes today, future
                days and rest days. Sessions count by local start date; time is
                split at midnight. {data.timezone}.
              </p>
            </section>
          </>
        )}
        {error && !editor && !extra && (
          <p role="alert" className="text-danger">
            {error}
            <Button onClick={query.reload}>Reload latest</Button>
          </p>
        )}
      </aside>
      {editor && (
        <Dialog
          open
          title={
            editor.config.removed ? "Remove study schedule" : "Study schedule"
          }
          description="Choose study days. Activities appear automatically in Home. Historical records and edited occurrences are preserved."
          onOpenChange={(open) => {
            if (!open && !busy && window.confirm("Discard schedule changes?"))
              setEditor(null);
          }}
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void save({
                action: "studyScheduleSave",
                id: editor.schedule?.id,
                version: editor.schedule?.version,
                roadmapId: roadmap.id,
                sectionId,
                config: {
                  ...editor.config,
                  time: editor.config.removed
                    ? editor.config.time
                    : String(new FormData(e.currentTarget).get("time") ?? "") ||
                      null,
                },
              });
            }}
          >
            {!editor.config.removed && (
              <>
                <fieldset>
                  <legend className="mb-2 text-xs text-muted">
                    Study days
                  </legend>
                  <div className="flex flex-wrap gap-1">
                    {weekdays.map((d, i) => (
                      <label
                        key={d}
                        className="flex min-h-11 items-center gap-1 rounded-lg border border-border p-2"
                      >
                        <input
                          type="checkbox"
                          checked={editor.config.weekdays.includes(i + 1)}
                          onChange={(e) =>
                            setEditor({
                              ...editor,
                              config: {
                                ...editor.config,
                                weekdays: e.target.checked
                                  ? [...editor.config.weekdays, i + 1].sort()
                                  : editor.config.weekdays.filter(
                                      (x) => x !== i + 1,
                                    ),
                              },
                            })
                          }
                        />
                        {d}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label>
                  Recommended start (optional)
                  <input
                    name="time"
                    type="time"
                    value={editor.config.time ?? ""}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        config: {
                          ...editor.config,
                          time: e.target.value || null,
                        },
                      })
                    }
                  />
                </label>
                <label>
                  Preferred duration (minutes)
                  <input
                    type="number"
                    required
                    min={1}
                    max={1440}
                    value={editor.config.minutes}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        config: {
                          ...editor.config,
                          minutes: Number(e.target.value),
                        },
                      })
                    }
                  />
                </label>
                <label className="flex min-h-11 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editor.config.paused}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        config: { ...editor.config, paused: e.target.checked },
                      })
                    }
                  />
                  Paused
                </label>
              </>
            )}
            {editor.config.removed && (
              <p className="text-sm">
                Stop future untouched occurrences of this schedule? Past study
                history remains available. You can restore it later.
              </p>
            )}
            {error && (
              <p role="alert" className="text-danger">
                {error}
              </p>
            )}
            <Button
              type="submit"
              variant={editor.config.removed ? "danger" : "primary"}
              disabled={busy || !editor.config.weekdays.length}
            >
              {busy
                ? "Saving…"
                : editor.config.removed
                  ? "Remove schedule"
                  : "Save schedule"}
            </Button>
            {editor.config.removed && (
              <Button
                disabled={busy}
                onClick={() =>
                  setEditor({
                    ...editor,
                    config: { ...editor.config, removed: false },
                  })
                }
              >
                Restore / edit
              </Button>
            )}
          </form>
        </Dialog>
      )}
      {extra && (
        <Dialog
          open
          title="Study Anytime"
          description="Start now or choose a date. Reuses an open roadmap activity on that date unless you explicitly request an additional session."
          onOpenChange={(open) => {
            if (!open && !busy) setExtra(null);
          }}
        >
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const startNow =
                (e.nativeEvent as SubmitEvent).submitter?.getAttribute(
                  "value",
                ) === "now";
              void save({
                action: "studyTask",
                roadmapId: roadmap.id,
                ...extra,
                stepId: extra.stepId || null,
                startNow,
                time: startNow ? null : String(form.get("time") ?? "") || null,
                date: startNow
                  ? data!.today
                  : String(form.get("date") ?? extra.date),
              });
            }}
          >
            <label>
              Learning step
              <select
                value={extra.stepId}
                onChange={(e) => setExtra({ ...extra, stepId: e.target.value })}
              >
                <option value="">No step · roadmap only</option>
                {steps.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Date
              <input
                name="date"
                type="date"
                required
                min={data?.today}
                value={extra.date}
                onChange={(e) => setExtra({ ...extra, date: e.target.value })}
              />
            </label>
            <label>
              Recommended start
              <input
                name="time"
                type="time"
                value={extra.time}
                onChange={(e) => setExtra({ ...extra, time: e.target.value })}
              />
            </label>
            <label>
              Target duration (optional, defaults to 60 minutes)
              <input
                type="number"
                min={1}
                max={1440}
                value={extra.minutes ?? ""}
                onChange={(e) =>
                  setExtra({
                    ...extra,
                    minutes:
                      e.target.value === ""
                        ? undefined
                        : Number(e.target.value),
                  })
                }
              />
            </label>
            {error && (
              <p role="alert" className="text-danger">
                {error}
              </p>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={extra.additional}
                onChange={(e) =>
                  setExtra({ ...extra, additional: e.target.checked })
                }
              />
              Create an additional session even if one is already planned
            </label>
            <p className="text-xs text-muted">
              An existing activity keeps its duration and schedule. Pause any
              other running timer before starting here.
            </p>
            <Button type="submit" value="now" variant="primary" disabled={busy}>
              Start now
            </Button>
            <Button type="submit" value="schedule" disabled={busy}>
              Schedule session
            </Button>
          </form>
        </Dialog>
      )}
    </div>
  );
}
