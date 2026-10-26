import { and, eq, gte, lte, isNull } from "drizzle-orm";
import type { Store } from "../db/connection";
import { tasks, sessions, settings } from "../db/schema";
import { ensureOccurrences } from "./scheduling";
import { addDays, dayBounds, localDate } from "../../lib/dates";
import type { HomeData } from "../../lib/planner-types";
export function getDashboard(
  store: Store,
  from: string,
  to: string,
  now = Date.now(),
): HomeData {
  const config = store.db.select().from(settings).get()!;
  const today = localDate(now, config.timezone);
  ensureOccurrences(store, from, to, now);
  ensureOccurrences(store, today, addDays(today, 28), now);
  return store.sqlite.transaction(() => {
    const rows = store.db
      .select()
      .from(tasks)
      .where(and(gte(tasks.plannedDate, from), lte(tasks.plannedDate, to)))
      .all();
    const allSessions = store.db.select().from(sessions).all();
    const runningSession = allSessions.find((x) => x.endedAt === null);
    const runningTask = runningSession
      ? store.db
          .select()
          .from(tasks)
          .where(eq(tasks.id, runningSession.taskId))
          .get()
      : null;
    const entries = rows.map((task) => ({
      ...task,
      actualMs: allSessions
        .filter((s) => s.taskId === task.id && s.endedAt !== null)
        .reduce((n, s) => n + s.endedAt! - s.startedAt, 0),
    }));
    const days = [];
    for (let date = from; date <= to; date = addDays(date, 1)) {
      const [start, end] = dayBounds(date, config.timezone);
      const dayTasks = rows.filter(
        (t) => t.plannedDate === date && !t.optional,
      );
      days.push({
        date,
        required: dayTasks.length,
        done: dayTasks.filter((t) => t.status === "done").length,
        trackedMs: allSessions
          .filter((s) => s.endedAt !== null)
          .reduce(
            (n, s) =>
              n +
              Math.max(
                0,
                Math.min(end, s.endedAt!) - Math.max(start, s.startedAt),
              ),
            0,
          ),
      });
    }
    const due = rows.filter((t) => !t.optional && t.plannedDate <= today);
    return {
      tasks: entries,
      running:
        runningSession && runningTask
          ? { ...runningSession, title: runningTask.title }
          : null,
      sessions: allSessions.filter((s) => rows.some((t) => t.id === s.taskId)),
      serverNow: now,
      today,
      timezone: config.timezone,
      metrics: {
        completed: rows.filter((t) => t.status === "done").length,
        required: due.length,
        requiredDone: due.filter((t) => t.status === "done").length,
        plannedMinutes: rows
          .filter((t) => !t.optional && t.status !== "skipped")
          .reduce((n, t) => n + t.targetMinutes, 0),
        trackedMs: days.reduce((n, d) => n + d.trackedMs, 0),
        days,
      },
    };
  })();
}
export function getRunning(store: Store, now = Date.now()) {
  const running = store.db
    .select()
    .from(sessions)
    .where(isNull(sessions.endedAt))
    .get();
  const task = running
    ? store.db.select().from(tasks).where(eq(tasks.id, running.taskId)).get()
    : null;
  return {
    running:
      running && task
        ? { ...running, title: task.title, taskVersion: task.version }
        : null,
    serverNow: now,
  };
}
