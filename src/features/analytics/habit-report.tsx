"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { HabitAnalytics } from "@/lib/activity-analytics";
import { ActivityHeatmap } from "./activity-heatmap";
import styles from "./activity.module.css";
const QuantityChart = dynamic(
  () => import("./quantity-chart").then((m) => m.QuantityChart),
  { loading: () => <p role="status">Loading quantity chart…</p> },
);
export function HabitReport({ habits }: { habits: HabitAnalytics[] }) {
  const [selected, setSelected] = useState("");
  const habit = habits.find((h) => h.id === selected) ?? habits[0];
  const eligible = habits.reduce((n, h) => n + h.eligible, 0),
    successful = habits.reduce((n, h) => n + h.successful, 0);
  return (
    <section className={styles.panel} aria-labelledby="habit-analytics-title">
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Routines, in perspective</p>
          <h2 id="habit-analytics-title">Habit activity</h2>
          <p className={styles.note}>
            Daily goal adherence:{" "}
            {eligible
              ? `${Math.round((successful / eligible) * 100)}% · ${successful}/${eligible} eligible days`
              : "No eligible days"}
            . Weekly quotas are evaluated separately.
          </p>
        </div>
        <Link href="/habits">Manage habits ↗</Link>
      </header>
      {!habit ? (
        <p className={styles.note}>
          No habits yet. Create a habit to see its recorded history here.
        </p>
      ) : (
        <>
          <label className={styles.picker}>
            Habit
            <select
              value={habit.id}
              onChange={(e) => setSelected(e.target.value)}
            >
              {habits.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                  {h.archived ? " · Archived" : ""}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.summary}>
            <span>
              <strong>{habit.logged}</strong> logged days
            </span>
            <span>
              <strong>{habit.met}</strong> goal-met days
            </span>
            <span>
              <strong>
                {habit.rate === null ? "—" : `${Math.round(habit.rate)}%`}
              </strong>{" "}
              expected-day goals met
            </span>
          </div>
          <p className={styles.note}>
            {habit.successful}/{habit.eligible} elapsed expected days met their
            goal. Today, future, rest, awareness-only and flexible weekly days
            are excluded from this rate. Unscheduled logs stay visible without
            increasing adherence.
          </p>
          <div className={styles.columns}>
            <ActivityHeatmap
              key={habit.id}
              title={`${habit.name} activity`}
              cells={habit.days}
            />
            <div className={styles.detail}>
              <h3>Recorded patterns</h3>
              <p className={styles.note}>
                {habit.latestRun === null
                  ? "Daily runs aren’t meaningful for this schedule or awareness-only goal."
                  : `Latest verified run: ${habit.latestRun} · Longest: ${habit.longestRun} expected days within this selected period. Rest and unscheduled days do not break a run; an unknown expected day does.`}
              </p>
              {habit.dailyTrend.length > 0 && (
                <div className={styles.workouts}>
                  <h3>Expected-day goals · by week</h3>
                  {habit.dailyTrend.map((w) => (
                    <div key={w.date}>
                      <span>{w.date}</span>
                      <progress
                        aria-label={`Goal adherence week ${w.date}`}
                        value={w.met}
                        max={w.eligible}
                      />
                      <b>{Math.round((w.met / w.eligible) * 100)}%</b>
                    </div>
                  ))}
                </div>
              )}
              {habit.archived && (
                <p className={styles.note}>
                  Archived history is retained. Missing dates are unknown
                  because archive/restore dates were not saved; they are
                  excluded from adherence.
                </p>
              )}
              {habit.weeks.length > 0 && (
                <div className={styles.weekly}>
                  <h3>Flexible weekly goals</h3>
                  {habit.weeks.map((w) => (
                    <p key={w.date}>
                      <span>Week of {w.date}</span>
                      <strong>
                        {w.goalDays}/{w.target} goal days recorded
                      </strong>
                      <small>
                        {w.eligible
                          ? w.met
                            ? "Weekly goal met"
                            : "Weekly goal not yet recorded"
                          : "Not rated · partial week, changed settings, awareness or archived"}
                      </small>
                    </p>
                  ))}
                  <p className={styles.note}>
                    {habit.weeks.filter((w) => w.met).length}/
                    {habit.weeks.filter((w) => w.eligible).length} eligible full
                    weeks met their quota. No daily misses are inferred.
                  </p>
                </div>
              )}
              {habit.workouts.length > 0 && (
                <div className={styles.workouts}>
                  <h3>Workouts actually performed</h3>
                  {habit.workouts.map((w) => (
                    <div key={w.name}>
                      <span>{w.name}</span>
                      <progress
                        aria-label={`${w.name} workouts`}
                        value={w.count}
                        max={habit.workouts.reduce((n, x) => n + x.count, 0)}
                      />
                      <b>{w.count}</b>
                    </div>
                  ))}
                  <p className={styles.note}>
                    Counts use the saved workout, not the planned rotation. Rest
                    is separate. Missing dates in a rest-capable rotation remain
                    unknown and are excluded from adherence because historical
                    rest decisions were not saved.
                  </p>
                </div>
              )}
              {!habit.quantities.length && !habit.workouts.length && (
                <p className={styles.note}>
                  Use the calendar to distinguish goal-met, exceeded, recorded,
                  rest and unlogged days. An explicitly recorded zero can meet
                  an Avoid goal; an absent entry never does.
                </p>
              )}
            </div>
          </div>
          {habit.quantities.map((series) => (
            <div key={series.unit} className={styles.quantity}>
              <h3>Recorded quantity · {series.unit || "units"}</h3>
              <QuantityChart series={series} />
            </div>
          ))}
          <details className={styles.values}>
            <summary>All habit day details</summary>
            <div>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Saved result / expectation</th>
                  </tr>
                </thead>
                <tbody>
                  {habit.days.map((d) => (
                    <tr key={d.date}>
                      <th scope="row">{d.date}</th>
                      <td>{d.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
