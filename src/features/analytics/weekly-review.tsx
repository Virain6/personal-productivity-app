"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePlannerQuery } from "@/lib/use-planner-query";
import { addDays, weekStart, formatDuration } from "@/lib/dates";
import { roadmapColor } from "@/lib/roadmap-colors";
import { weeklyHighlights, type WeeklyReviewData } from "@/lib/weekly-review";
import styles from "./weekly-review.module.css";
const TimeChart = dynamic(() =>
  import("./time-chart").then((m) => m.TimeChart),
);
const ReflectionEditor = dynamic(
  () => import("./reflection-editor").then((m) => m.ReflectionEditor),
  { ssr: false, loading: () => <p role="status">Loading reflections…</p> },
);
export function WeeklyReview() {
  const [week, setWeek] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pendingWeek, setPendingWeek] = useState<string | null>(null);
  const { data, error, reload } = usePlannerQuery<WeeklyReviewData>(
    `/api/planner?view=weeklyReview${week ? `&week=${week}` : ""}`,
  );
  const a = data?.analytics,
    h = a ? weeklyHighlights(a) : null;
  function navigate(next: string) {
    if (next === a?.range.from) return;
    if (dirty) {
      setPendingWeek(next);
      return;
    }
    setWeek(next);
  }
  return (
    <div className={styles.page}>
      <Dialog
        open={pendingWeek !== null}
        onOpenChange={(open) => {
          if (!open) setPendingWeek(null);
        }}
        title="Unsaved reflections"
        description="Save before leaving to keep your reflection across devices. You can also change weeks and keep this draft in the current browser tab."
      >
        <div className={styles.actions}>
          <Button variant="primary" onClick={() => setPendingWeek(null)}>
            Keep editing
          </Button>
          <Button
            onClick={() => {
              setWeek(pendingWeek);
              setPendingWeek(null);
            }}
          >
            Change week, keep draft
          </Button>
        </div>
      </Dialog>
      <header>
        <Link href="/analytics">← Analytics overview</Link>
        <p className={styles.eyebrow}>Pause. Notice. Plan.</p>
        <h1>Weekly Review</h1>
        <p className={styles.note}>
          Your recorded week, with room for what the numbers cannot tell you.
        </p>
      </header>
      {error && (
        <p role="alert" className={styles.error}>
          {error} <Button onClick={reload}>Retry</Button>
        </p>
      )}
      {!a || !data || !h ? (
        <p role="status">Loading this week…</p>
      ) : (
        <>
          <nav className={styles.navigation} aria-label="Review week">
            <Button
              aria-label="Previous review week"
              onClick={() => navigate(addDays(a.range.from, -7))}
            >
              ←
            </Button>
            <div>
              <strong>
                {a.range.from} — {a.range.to}
              </strong>
              <small>
                Monday–Sunday · {a.timezone}
                {a.range.to >= a.today ? " · Week still open" : ""}
              </small>
            </div>
            <Button
              aria-label="Next review week"
              onClick={() => navigate(addDays(a.range.from, 7))}
            >
              →
            </Button>
            <Button onClick={() => navigate(weekStart(a.today))}>
              Current week
            </Button>
          </nav>
          <div className={styles.stats}>
            <div>
              <span>Recorded study</span>
              <strong>{formatDuration(a.summary.studyMs)}</strong>
              <small>
                {a.summary.studySessions} saved sessions started this week
              </small>
            </div>
            <div>
              <span>Completed tasks</span>
              <strong>{a.summary.completedTasks}</strong>
              <progress
                aria-label="Required task completion"
                max={a.summary.requiredTasks || 1}
                value={a.summary.completedRequired}
              />
              <small>
                {a.summary.completedRequired}/{a.summary.requiredTasks} required
                through today
              </small>
            </div>
            <div>
              <span>Habit goals met</span>
              <strong>
                {h.habitRate === null ? "—" : `${Math.round(h.habitRate)}%`}
              </strong>
              <progress
                aria-label="Eligible habit completion"
                max={h.eligible || 1}
                value={h.met}
              />
              <small>
                {h.met}/{h.eligible} eligible elapsed days
              </small>
            </div>
          </div>
          <p className={styles.note}>
            {a.previous?.hasStudy
              ? `${formatDuration(Math.abs(a.summary.studyMs - a.previous.studyMs))} ${a.summary.studyMs >= a.previous.studyMs ? "more" : "less"} study than ${a.previous.from} — ${a.previous.to}${a.range.to >= a.today ? " (matching elapsed days)" : ""}.`
              : "No recorded study in the comparable previous period; no change is inferred."}{" "}
            Saved time and task completion are separate.
          </p>
          <div className={styles.columns}>
            <section className={styles.panel}>
              <h2>Seven days, at a glance</h2>
              <TimeChart rows={a.days} />
              <p className={styles.note}>
                {h.mostActive.length
                  ? `Most active: ${h.mostActive.map((d) => d.date).join(", ")} · ${formatDuration(h.mostActive[0].studyMs)}${h.mostActive.length > 1 ? " each (tie)" : ""}.`
                  : "No saved study time this week."}
              </p>
            </section>
            <section className={styles.panel}>
              <h2>Where you studied</h2>
              {a.roadmaps
                .filter((r) => r.studyMs > 0)
                .map((r) => (
                  <div key={r.id} className={styles.roadmap}>
                    <span>
                      {r.title}
                      {r.archived ? " · Archived" : ""}
                    </span>
                    <strong>{formatDuration(r.studyMs)}</strong>
                    <progress
                      style={
                        {
                          "--bar-color": roadmapColor(r.color),
                        } as import("react").CSSProperties
                      }
                      aria-label={`${r.title} share of study time`}
                      max={a.summary.studyMs || 1}
                      value={r.studyMs}
                    />
                  </div>
                ))}
              {!a.summary.studyMs && (
                <p className={styles.note}>
                  Study logged through Home or Learning will appear here.
                </p>
              )}
              <hr />
              <h3>Learning activities</h3>
              <p className={styles.note}>
                {a.summary.studyTasks.completed} completed / {h.scheduled}{" "}
                planned activities this week.
              </p>
              <div className={styles.tags}>
                <span>{a.summary.studyTasks.missed} unfinished past</span>
                <span>{a.summary.studyTasks.skipped} skipped</span>
                <span>{a.summary.studyTasks.open} open</span>
                <span>{a.summary.studyTasks.upcoming} upcoming</span>
              </div>
              <p className={styles.note}>
                Includes recurring and one-off learning activities. Future
                activities are never missed. Completion does not imply recorded
                time.
              </p>
            </section>
          </div>
          <p className={styles.note}>
            Habit rate reuses eligible-day goals: today, future, unscheduled,
            rest, awareness-only and uncertain history are excluded. Missing
            logs never count as success. Flexible weekly goals: {h.weeklyMet}/
            {h.weeklyEligible} eligible full-week quotas met.
          </p>
          <div className={styles.reflections}>
            <ReflectionEditor
              key={a.range.from}
              week={a.range.from}
              saved={data.reflection}
              onDirty={setDirty}
              onSaved={reload}
            />
            <aside className={styles.panel}>
              <h2>Review history</h2>
              <p className={styles.note}>Weeks with saved reflections.</p>
              {!data.history.length ? (
                <p className={styles.note}>
                  Your first saved reflection will appear here.
                </p>
              ) : (
                <div className={styles.history}>
                  {data.history.map((r) => (
                    <Button
                      key={r.week}
                      aria-pressed={r.week === a.range.from}
                      onClick={() => navigate(r.week)}
                    >
                      {r.week} — {addDays(r.week, 6)}
                    </Button>
                  ))}
                </div>
              )}
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
