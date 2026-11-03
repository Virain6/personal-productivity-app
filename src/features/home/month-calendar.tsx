"use client";
import { DateTime } from "luxon";
import type { HomeData } from "@/lib/planner-types";
import {
  habitOutcome,
  habitResult,
  type HabitCalendarData,
} from "@/lib/habit-types";
import {
  monthGrid,
  monthTaskStatus,
  monthTaskColor,
} from "@/lib/month-calendar";
import { compareAgenda } from "@/lib/home";
import styles from "./month-calendar.module.css";
export function MonthCalendar({
  date,
  today,
  data,
  habits,
  onOpenDay,
}: {
  date: string;
  today: string;
  data: HomeData;
  habits: HabitCalendarData | null;
  onOpenDay: (date: string) => void;
}) {
  const grid = monthGrid(date);
  return (
    <div>
      <p className={styles.hint}>
        Select a date to open its activities. Past unfinished tasks are marked
        ◷; habits retain their recorded goal status.
      </p>
      <div className={styles.weekdays} aria-hidden="true">
        {[
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div
        className={styles.grid}
        aria-label={`${DateTime.fromISO(date).toFormat("MMMM yyyy")} calendar`}
      >
        {grid.days.map((day) => {
          const tasks = data.tasks
            .filter((t) => t.plannedDate === day)
            .sort((a, b) => compareAgenda(a, b, data.timezone));
          const completed = tasks.filter((t) => t.status === "done").length;
          const skipped = tasks.filter((t) => t.status === "skipped").length;
          const dailyHabits =
            habits?.days.find((d) => d.date === day)?.habits ?? [];
          const items = [
            ...tasks.map((t) => ({
              id: t.id,
              title: t.title,
              detail: monthTaskStatus(t, today),
              color: monthTaskColor(t),
              symbol:
                t.status === "done"
                  ? "✓"
                  : t.status === "skipped"
                    ? "−"
                    : day < today && !t.optional
                      ? "◷"
                      : "·",
              state:
                t.status === "done"
                  ? "met"
                  : t.status === "skipped"
                    ? "skipped"
                    : "task",
            })),
            ...dailyHabits.map((h) => ({
              id: `habit:${h.id}`,
              title: h.dateConfig!.name,
              detail:
                day > today
                  ? "Future habit"
                  : habitResult(h.dateConfig!, h.record),
              color: "var(--success)",
              symbol: "◇",
              state:
                day > today ? "future" : habitOutcome(h.dateConfig!, h.record),
            })),
          ];
          return (
            <button
              key={day}
              type="button"
              className={styles.cell}
              data-adjacent={!day.startsWith(grid.month)}
              data-selected={date === day}
              aria-current={today === day ? "date" : undefined}
              aria-label={`Open ${DateTime.fromISO(day).toFormat("cccc, MMMM d, yyyy")} in Day view · ${tasks.length} tasks (${completed} completed, ${skipped} skipped) · ${dailyHabits.length} habits`}
              onClick={() => onOpenDay(day)}
            >
              <span className={styles.date}>
                <span className={today === day ? styles.today : ""}>
                  {DateTime.fromISO(day).day}
                </span>
                <small>
                  {[
                    today === day ? "Today" : "",
                    completed ? `✓ ${completed}` : "",
                    skipped ? `− ${skipped}` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
              </span>
              <span className={styles.items}>
                {items.slice(0, 3).map((i) => (
                  <span
                    key={i.id}
                    className={styles.item}
                    data-state={i.state}
                    style={
                      {
                        "--item-color": i.color,
                      } as import("react").CSSProperties
                    }
                    title={`${i.title} · ${i.detail}`}
                  >
                    <b aria-hidden="true">{i.symbol}</b>
                    <span>{i.title}</span>
                    <span className="sr-only"> · {i.detail}</span>
                  </span>
                ))}
              </span>
              {items.length > 3 && (
                <span className={styles.more}>+{items.length - 3} more</span>
              )}
              {!!dailyHabits.length && (
                <span className={styles.habits}>
                  ◇ {dailyHabits.length} habits
                  {day > today
                    ? " · planned"
                    : ` · ${dailyHabits.filter((h) => habitOutcome(h.dateConfig!, h.record) === "met").length} met${dailyHabits.some((h) => habitOutcome(h.dateConfig!, h.record) === "exceeded") ? " · exceeded" : ""}`}
                </span>
              )}
              {!items.length && (
                <span className={styles.empty}>No activities</span>
              )}
            </button>
          );
        })}
      </div>
      <p className={styles.hint}>
        ✓ Completed · − Skipped · ◷ Unfinished past · ◇ Habit. Future dates are
        never marked missed. Open a day for full details and actions.
      </p>
    </div>
  );
}
