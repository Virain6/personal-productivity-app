"use client";
import { useState } from "react";
import { DateTime } from "luxon";
import { clockDuration } from "@/lib/dates";
import type { ActivityCell, ActivityState } from "@/lib/activity-analytics";
import styles from "./activity.module.css";
const labels: Record<ActivityState, string> = {
  met: "Goal met",
  missed: "Expected · not logged",
  below: "Below goal",
  exceeded: "Exceeded",
  recorded: "Recorded",
  rest: "Rest",
  unscheduled: "Not scheduled",
  future: "Future",
  unlogged: "Not logged",
  unknown: "Unknown",
};
export function ActivityHeatmap({
  cells,
  title,
  learning = false,
  accent = "var(--success)",
}: {
  cells: ActivityCell[];
  title: string;
  learning?: boolean;
  accent?: string;
}) {
  const [chosenMonth, setMonth] = useState("");
  const [chosenDay, setDay] = useState("");
  const months = [...new Set(cells.map((d) => d.date.slice(0, 7)))];
  const month = months.includes(chosenMonth) ? chosenMonth : months[0];
  if (!month) return <p>No dates selected.</p>;
  const start = DateTime.fromISO(`${month}-01`, { zone: "UTC" });
  const byDate = new Map(cells.map((d) => [d.date, d]));
  const selected = byDate.get(chosenDay);
  const legend = [
    ...new Set(
      cells.filter((d) => d.date.startsWith(month)).map((d) => d.state),
    ),
  ];
  function label(state: ActivityState) {
    return learning && state === "met"
      ? "Studied"
      : learning && state === "recorded"
        ? "Studied · unscheduled"
        : learning && state === "missed"
          ? "Scheduled · no saved time"
          : labels[state];
  }
  return (
    <div
      className={styles.heatmap}
      data-learning={learning}
      style={{ "--activity-accent": accent } as import("react").CSSProperties}
    >
      <div className={styles.calendarHeader}>
        <h3>{title}</h3>
        <label>
          <span className="sr-only">{title} month</span>
          <select
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setDay("");
            }}
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {DateTime.fromISO(`${m}-01`).toFormat("MMMM yyyy")}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className={styles.calendar} aria-label={title}>
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
          <span key={d} className={styles.weekday}>
            {d}
          </span>
        ))}
        {Array.from({ length: start.weekday - 1 }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {Array.from({ length: start.daysInMonth! }, (_, i) => {
          const date = start.plus({ days: i }).toISODate()!,
            cell = byDate.get(date);
          const detail = cell
            ? `${label(cell.state)} · ${cell.detail}${learning ? ` · ${clockDuration(cell.amount ?? 0)}` : ""}`
            : "Outside selected period";
          return (
            <button
              key={date}
              disabled={!cell}
              className={styles.day}
              data-state={cell?.state}
              aria-pressed={date === chosenDay}
              aria-label={`${date}: ${detail}`}
              title={`${date}: ${detail}`}
              onClick={() => setDay(date)}
            >
              {i + 1}
              {cell?.amount ? (
                <span className={styles.dot} aria-hidden="true" />
              ) : null}
            </button>
          );
        })}
      </div>
      <p className={styles.dayDetail} aria-live="polite">
        {selected && selected.date.startsWith(month)
          ? `${selected.date} · ${selected.detail}${learning ? ` · ${clockDuration(selected.amount ?? 0)}` : ""}`
          : "Select a day for its recorded details."}
      </p>
      <div className={styles.legend}>
        {legend.map((state) => (
          <span key={state}>
            <i data-state={state} />
            {label(state)}
          </span>
        ))}
      </div>
    </div>
  );
}
