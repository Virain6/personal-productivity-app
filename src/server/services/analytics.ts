import { getHabitAnalytics } from "./habit-analytics";
import type { ActivityCell } from "../../lib/activity-analytics";
import { DateTime } from "luxon";
import type { Store } from "../db/connection";
import { settings } from "../db/schema";
import { ensureOccurrences } from "./scheduling";
import { DomainError } from "./validation";
import { addDays, dayBounds, localDate, weekStart } from "../../lib/dates";
import { presetRange, rangeError } from "../../lib/analytics-range";
import type {
  AnalyticsData,
  AnalyticsDay,
  AnalyticsRange,
  AnalyticsRoadmap,
} from "../../lib/analytics-types";

type SavedSession = {
  start: number;
  end: number;
  roadmapId: string | null;
  moduleId: string | null;
};
type PlannedTask = {
  date: string;
  status: string;
  optional: number;
  minutes: number;
  roadmapId: string | null;
};
const overlap = (start: number, end: number, a: number, b: number) =>
  Math.max(0, Math.min(end, b) - Math.max(start, a));

export function getAnalytics(
  store: Store,
  requested?: AnalyticsRange,
  now = Date.now(),
): AnalyticsData {
  const timezone = store.db.select().from(settings).get()!.timezone;
  const today = localDate(now, timezone);
  const range = requested ?? presetRange("week", today);
  const error = rangeError(range);
  if (error) throw new DomainError(error);
  // Generate only this bounded range, using the same deduplicated engine as Home.
  ensureOccurrences(store, range.from, range.to, now);
  return store.sqlite.transaction(() => {
    const count =
      DateTime.fromISO(range.to, { zone: "UTC" }).diff(
        DateTime.fromISO(range.from, { zone: "UTC" }),
        "days",
      ).days + 1;
    const elapsedEnd = range.to < today ? range.to : today;
    const previousFrom = addDays(range.from, -count);
    const previousTo = addDays(elapsedEnd, -count);
    const trendFrom = addDays(weekStart(range.to), -49);
    const queryFrom = [previousFrom, trendFrom, range.from].sort()[0];
    const [queryStart] = dayBounds(queryFrom, timezone);
    const [start] = dayBounds(range.from, timezone);
    const [, end] = dayBounds(range.to, timezone);
    // One-to-one link join: timer/manual records are each counted exactly once.
    // Filter before loading; never send raw session history to the browser.
    const sessions = store.sqlite
      .prepare(
        `SELECT s.started_at AS start,s.ended_at AS end,l.roadmap_id AS roadmapId,l.section_id AS moduleId
      FROM time_sessions s LEFT JOIN session_learning l ON l.session_id=s.id
      WHERE s.ended_at IS NOT NULL AND s.ended_at>? AND s.started_at<?`,
      )
      .all(queryStart, end) as SavedSession[];
    const tasks = store.sqlite
      .prepare(
        `SELECT t.planned_date AS date,t.status,t.optional,t.target_minutes AS minutes,x.roadmap_id AS roadmapId
      FROM tasks t LEFT JOIN task_study x ON x.task_id=t.id
      WHERE t.planned_date BETWEEN ? AND ? AND COALESCE(x.cancelled,0)=0
      AND NOT EXISTS(SELECT 1 FROM retired_study_tasks r WHERE r.task_id=t.id)`,
      )
      .all(range.from, range.to) as PlannedTask[];
    const maps = store.sqlite
      .prepare(`SELECT id,title,color,archived FROM roadmaps ORDER BY title,id`)
      .all() as {
      id: string;
      title: string;
      color: string;
      archived: number;
    }[];
    const modules = store.sqlite
      .prepare(
        `SELECT m.id,m.roadmap_id AS roadmapId,m.title,m.archived,m.deleted,
      COUNT(CASE WHEN s.deleted=0 THEN s.id END) AS steps,
      COUNT(CASE WHEN s.deleted=0 AND s.status='completed' THEN s.id END) AS completed
      FROM roadmap_sections m LEFT JOIN learning_steps s ON s.section_id=m.id GROUP BY m.id ORDER BY m.position,m.id`,
      )
      .all() as {
      id: string;
      roadmapId: string;
      title: string;
      archived: number;
      deleted: number;
      steps: number;
      completed: number;
    }[];
    const days: AnalyticsDay[] = [];
    for (let date = range.from; date <= range.to; date = addDays(date, 1)) {
      const [a, b] = dayBounds(date, timezone);
      days.push({
        date,
        studyMs: 0,
        trackedMs: 0,
        plannedMs: tasks
          .filter((t) => t.date === date && t.roadmapId)
          .reduce((n, t) => n + t.minutes * 60000, 0),
        studySessions: 0,
      });
      const day = days[days.length - 1];
      for (const session of sessions) {
        const ms = overlap(session.start, session.end, a, b);
        day.trackedMs += ms;
        if (session.roadmapId) {
          day.studyMs += ms;
          if (session.start >= a && session.start < b) day.studySessions++;
        }
      }
    }
    const roadmaps: AnalyticsRoadmap[] = maps
      .map((map) => {
        const linked = sessions.filter(
          (s) =>
            s.roadmapId === map.id && overlap(s.start, s.end, start, end) > 0,
        );
        const activity: ActivityCell[] = days.map((day) => {
          const [a, b] = dayBounds(day.date, timezone);
          const studyMs = linked.reduce(
            (n, s) => n + overlap(s.start, s.end, a, b),
            0,
          );
          const scheduled = tasks.filter(
            (t) => t.roadmapId === map.id && t.date === day.date && !t.optional,
          );
          const completed = scheduled.filter((t) => t.status === "done").length;
          return {
            date: day.date,
            amount: studyMs,
            state:
              day.date > today
                ? "future"
                : studyMs > 0
                  ? scheduled.length
                    ? "met"
                    : "recorded"
                  : scheduled.length
                    ? day.date < today
                      ? "missed"
                      : "unlogged"
                    : "unscheduled",
            detail: `${studyMs > 0 ? "Recorded study" : "No saved study"} · ${completed}/${scheduled.length} required activities completed${scheduled.some((t) => t.status === "skipped") ? " · Includes skipped activity" : ""}`,
          };
        });
        const eligibleDays = activity.filter(
          (d) =>
            d.date < today &&
            tasks.some(
              (t) => t.roadmapId === map.id && t.date === d.date && !t.optional,
            ),
        );
        const studiedScheduledDays = eligibleDays.filter(
          (d) => d.amount! > 0,
        ).length;
        const activeModules = modules.filter(
          (m) => m.roadmapId === map.id && !m.deleted && !m.archived,
        );
        return {
          activity,
          dailyTime: activity.map((d) => ({
            date: d.date,
            studyMs: d.amount ?? 0,
          })),
          eligibleDays: eligibleDays.length,
          studiedScheduledDays,
          consistency: eligibleDays.length
            ? (studiedScheduledDays / eligibleDays.length) * 100
            : null,
          mastery: {
            completed: activeModules.reduce((n, m) => n + m.completed, 0),
            steps: activeModules.reduce((n, m) => n + m.steps, 0),
          },
          ...map,
          archived: Boolean(map.archived),
          studyMs: linked.reduce(
            (n, s) => n + overlap(s.start, s.end, start, end),
            0,
          ),
          sessions: linked.filter((s) => s.start >= start && s.start < end)
            .length,
          lastStudied: linked.length
            ? localDate(
                Math.max(...linked.map((s) => Math.min(s.end, end) - 1)),
                timezone,
              )
            : null,
          modules: modules
            .filter((m) => m.roadmapId === map.id)
            .map((m) => ({
              id: m.id,
              title: m.title,
              archived: Boolean(m.archived || m.deleted),
              steps: m.steps,
              completed: m.completed,
              studyMs: linked
                .filter((s) => s.moduleId === m.id)
                .reduce((n, s) => n + overlap(s.start, s.end, start, end), 0),
            })),
        };
      })
      .sort((a, b) => b.studyMs - a.studyMs || a.title.localeCompare(b.title));
    const required = tasks.filter((t) => !t.optional && t.date <= today);
    const completedRequired = required.filter(
      (t) => t.status === "done",
    ).length;
    const studyTasks = {
      completed: 0,
      skipped: 0,
      missed: 0,
      open: 0,
      upcoming: 0,
    };
    for (const task of tasks.filter((t) => t.roadmapId)) {
      if (task.status === "done") studyTasks.completed++;
      else if (task.status === "skipped") studyTasks.skipped++;
      else if (task.date > today) studyTasks.upcoming++;
      else if (task.date < today && !task.optional) studyTasks.missed++;
      else studyTasks.open++;
    }
    const trend = Array.from({ length: 8 }, (_, i) => {
      const date = addDays(trendFrom, i * 7);
      const [a] = dayBounds(date, timezone);
      const [, b] = dayBounds(addDays(date, 6), timezone);
      return {
        date,
        studyMs: sessions
          .filter((s) => s.roadmapId)
          .reduce(
            (n, s) => n + overlap(s.start, s.end, a, Math.min(b, end)),
            0,
          ),
      };
    });
    const [pa] = dayBounds(previousFrom, timezone);
    const [, pb] = dayBounds(previousTo, timezone);
    const previousSessions = sessions.filter(
      (s) => overlap(s.start, s.end, pa, pb) > 0,
    );
    return {
      range,
      timezone,
      today,
      days,
      trend,
      roadmaps,
      habits: getHabitAnalytics(store, range, today),
      summary: {
        studyMs: days.reduce((n, d) => n + d.studyMs, 0),
        trackedMs: days.reduce((n, d) => n + d.trackedMs, 0),
        plannedMs: days.reduce((n, d) => n + d.plannedMs, 0),
        studySessions: days.reduce((n, d) => n + d.studySessions, 0),
        completedTasks: tasks.filter((t) => t.status === "done").length,
        requiredTasks: required.length,
        completedRequired,
        completionRate: required.length
          ? (completedRequired / required.length) * 100
          : null,
        studyTasks,
      },
      previous:
        elapsedEnd >= range.from && previousSessions.length
          ? {
              from: previousFrom,
              to: previousTo,
              hasStudy: previousSessions.some((s) => s.roadmapId),
              studyMs: previousSessions
                .filter((s) => s.roadmapId)
                .reduce((n, s) => n + overlap(s.start, s.end, pa, pb), 0),
              trackedMs: previousSessions.reduce(
                (n, s) => n + overlap(s.start, s.end, pa, pb),
                0,
              ),
            }
          : null,
    };
  })();
}
