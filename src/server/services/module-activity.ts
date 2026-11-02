import { DateTime } from "luxon";
import { eq } from "drizzle-orm";
import type { Store } from "../db/connection";
import {
  settings,
  roadmapSections,
  roadmaps,
  studySchedules,
  studyScheduleVersions,
  studyTemplateLinks,
  templates,
} from "../db/schema";
import { ensureOccurrences } from "./scheduling";
import { addDays, dayBounds, localDate, validDate } from "../../lib/dates";
import { DomainError } from "./validation";
import type { ModuleData, ModuleDay } from "../../lib/module-types";
export function getModuleActivity(
  store: Store,
  roadmapId: string,
  sectionId: string | null,
  month: string,
  now = Date.now(),
): ModuleData {
  const zone = store.db.select().from(settings).get()!.timezone,
    today = localDate(now, zone);
  const start = month ? `${month}-01` : `${today.slice(0, 7)}-01`;
  if (!validDate(start)) throw new DomainError("Choose a valid month.");
  const end = DateTime.fromISO(start, { zone: "UTC" })
    .endOf("month")
    .toISODate()!;
  const map = store.db
    .select()
    .from(roadmaps)
    .where(eq(roadmaps.id, roadmapId))
    .get();
  const section = sectionId
    ? store.db
        .select()
        .from(roadmapSections)
        .where(eq(roadmapSections.id, sectionId))
        .get()
    : null;
  if (!map || (sectionId && (!section || section.roadmapId !== roadmapId)))
    throw new DomainError("Module not found.", 404);
  ensureOccurrences(store, start, end, now);
  return store.sqlite.transaction(() => {
    const history = store.sqlite
      .prepare(
        `SELECT s.id,s.started_at AS startedAt,s.ended_at AS endedAt,l.step_title AS title,s.summary FROM time_sessions s JOIN session_learning l ON l.session_id=s.id WHERE l.roadmap_id=? AND (? IS NULL OR l.section_id=?) ORDER BY s.started_at DESC,s.id`,
      )
      .all(roadmapId, sectionId, sectionId) as ModuleData["history"];
    const occurrences = store.sqlite
      .prepare(
        `SELECT t.id,t.title,t.planned_date AS plannedDate,t.status,(x.cancelled OR EXISTS(SELECT 1 FROM retired_study_tasks r WHERE r.task_id=t.id)) AS cancelled,x.section_id AS sectionId,x.schedule_id AS scheduleId FROM tasks t JOIN task_study x ON x.task_id=t.id WHERE x.roadmap_id=? AND (? IS NULL OR x.section_id=?) AND t.planned_date BETWEEN ? AND ? ORDER BY t.planned_date,t.id`,
      )
      .all(
        roadmapId,
        sectionId,
        sectionId,
        start,
        end,
      ) as ModuleData["occurrences"];
    const closed = history.filter((s) => s.endedAt !== null);
    const days: ModuleDay[] = [];
    for (let date = start; date <= end; date = addDays(date, 1)) {
      const [a, b] = dayBounds(date, zone),
        planned = occurrences.filter(
          (t) => !t.cancelled && t.plannedDate === date,
        );
      const studiedMs = closed.reduce(
        (n, s) =>
          n + Math.max(0, Math.min(b, s.endedAt!) - Math.max(a, s.startedAt)),
        0,
      );
      const completed = planned.filter((t) => t.status === "done").length;
      days.push({
        date,
        studiedMs,
        sessionCount: closed.filter(
          (s) => localDate(s.startedAt, zone) === date,
        ).length,
        scheduled: planned.length,
        completed,
        state: planned.length
          ? date > today
            ? "future"
            : completed === planned.length
              ? "completed"
              : date === today
                ? "today"
                : "missed"
          : studiedMs > 0
            ? "unscheduled"
            : "rest",
      });
    }
    const eligible = days.filter((d) => d.date < today && d.scheduled > 0),
      successful = eligible.filter((d) => d.completed === d.scheduled);
    const [a] = dayBounds(start, zone),
      [, b] = dayBounds(end, zone);
    const links = store.db.select().from(studyTemplateLinks).all();
    return {
      today,
      timezone: zone,
      month: start.slice(0, 7),
      days,
      occurrences,
      history,
      totals: {
        studiedMs: closed.reduce((n, s) => n + s.endedAt! - s.startedAt, 0),
        sessions: closed.length,
        lastStudied: closed.length
          ? localDate(Math.max(...closed.map((s) => s.endedAt! - 1)), zone)
          : null,
      },
      monthStats: {
        studiedMs: closed.reduce(
          (n, s) =>
            n + Math.max(0, Math.min(b, s.endedAt!) - Math.max(a, s.startedAt)),
          0,
        ),
        sessions: closed.filter((s) => s.startedAt >= a && s.startedAt < b)
          .length,
        completed: days.reduce((n, d) => n + d.completed, 0),
        eligibleDays: eligible.length,
        successfulDays: successful.length,
        consistency: eligible.length
          ? (successful.length / eligible.length) * 100
          : null,
      },
      schedules: store.db
        .select()
        .from(studySchedules)
        .where(eq(studySchedules.roadmapId, roadmapId))
        .all()
        .map((s) => ({
          ...s,
          config: store.db
            .select()
            .from(studyScheduleVersions)
            .where(eq(studyScheduleVersions.scheduleId, s.id))
            .all()
            .sort((a, b) => b.version - a.version)[0].config,
        })),
      templates: store.db
        .select()
        .from(templates)
        .all()
        .filter(
          (t) =>
            !["Project", "Applications"].includes(t.category) &&
            !links.some((l) => l.templateId === t.id) &&
            (!t.effectiveUntil || t.effectiveUntil >= today),
        )
        .map((t) => ({
          id: t.id,
          title: t.title,
          weekday: t.weekday,
          targetMinutes: t.targetMinutes,
          suggestedTime: t.suggestedTime,
        })),
    };
  })();
}
