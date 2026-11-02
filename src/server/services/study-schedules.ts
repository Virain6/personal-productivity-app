import { randomUUID } from "node:crypto";
import { eq, asc } from "drizzle-orm";
import type { Store } from "../db/connection";
import {
  studySchedules,
  studyScheduleVersions,
  studyTemplateLinks,
  templates,
  taskStudy,
  tasks,
  roadmaps,
  roadmapSections,
  learningSteps,
  settings,
  taskLearning,
} from "../db/schema";
import { localDate } from "../../lib/dates";
import type { StudyScheduleCommand } from "./study-schedule-validation";
import { DomainError } from "./validation";
import { saveTask } from "./tasks";
import { categories } from "../../lib/planner-types";
import { ensureOccurrences } from "./scheduling";
export function scheduleForDate(store: Store, id: string, date: string) {
  return store.db
    .select()
    .from(studyScheduleVersions)
    .where(eq(studyScheduleVersions.scheduleId, id))
    .all()
    .filter((r) => r.effectiveFrom <= date)
    .sort((a, b) => b.version - a.version)[0]?.config;
}
export function recommendedStep(
  store: Store,
  roadmapId: string,
  sectionId: string | null,
) {
  const m = store.db
    .select()
    .from(roadmaps)
    .where(eq(roadmaps.id, roadmapId))
    .get();
  if (!m || m.archived) return null;
  const sections = store.db
    .select()
    .from(roadmapSections)
    .where(eq(roadmapSections.roadmapId, roadmapId))
    .orderBy(asc(roadmapSections.position))
    .all()
    .filter(
      (s) => !s.deleted && !s.archived && (!sectionId || s.id === sectionId),
    );
  const steps = sections.flatMap((s) =>
    store.db
      .select()
      .from(learningSteps)
      .where(eq(learningSteps.sectionId, s.id))
      .orderBy(asc(learningSteps.position))
      .all()
      .filter((s) => !s.deleted),
  );
  return (
    steps.find((s) => s.id === m.currentStepId) ??
    steps.find((s) => !s.completed) ??
    null
  );
}
export function scheduleContext(
  store: Store,
  templateId: string,
  date: string,
) {
  const link = store.db
    .select()
    .from(studyTemplateLinks)
    .where(eq(studyTemplateLinks.templateId, templateId))
    .get();
  if (!link) return null;
  const schedule = store.db
    .select()
    .from(studySchedules)
    .where(eq(studySchedules.id, link.scheduleId))
    .get()!;
  const config = scheduleForDate(store, schedule.id, date);
  if (!config) return null;
  const roadmap = store.db
    .select()
    .from(roadmaps)
    .where(eq(roadmaps.id, schedule.roadmapId))
    .get()!;
  const section = schedule.sectionId
    ? store.db
        .select()
        .from(roadmapSections)
        .where(eq(roadmapSections.id, schedule.sectionId))
        .get()
    : null;
  return {
    title: section ? `${roadmap.title} · ${section.title}` : roadmap.title,
    schedule,
    config,
    enabled:
      schedule.sectionId === null &&
      !roadmap.archived &&
      !config.paused &&
      !config.removed &&
      config.weekdays.includes(link.weekday),
  };
}
// Only untouched pending instances may follow a changed schedule. Stable template/date
// identities remain even when cancelled, preventing regeneration or duplicate replacements.
export function applyStudyOccurrence(
  store: Store,
  taskId: string,
  context: NonNullable<ReturnType<typeof scheduleContext>>,
  now: number,
  today: string,
) {
  const task = store.db.select().from(tasks).where(eq(tasks.id, taskId)).get()!;
  let scope = store.db
    .select()
    .from(taskStudy)
    .where(eq(taskStudy.taskId, taskId))
    .get();
  if (!scope) {
    store.db
      .insert(taskStudy)
      .values({
        taskId,
        scheduleId: context.schedule.id,
        roadmapId: context.schedule.roadmapId,
        sectionId: context.schedule.sectionId,
        managedVersion: 1,
      })
      .run();
    scope = store.db
      .select()
      .from(taskStudy)
      .where(eq(taskStudy.taskId, taskId))
      .get()!;
  }
  const used = store.sqlite
    .prepare("SELECT 1 FROM time_sessions WHERE task_id=? LIMIT 1")
    .get(taskId);
  const override = store.db
    .select()
    .from(taskLearning)
    .where(eq(taskLearning.taskId, taskId))
    .get();
  if (
    task.plannedDate < today ||
    task.version !== scope.managedVersion ||
    task.status !== "pending" ||
    used ||
    override
  )
    return;
  const cancelled = !context.enabled;
  if (
    scope.cancelled === cancelled &&
    task.title === context.title &&
    task.targetMinutes === context.config.minutes &&
    task.suggestedTime === context.config.time
  )
    return;
  store.db
    .update(tasks)
    .set({
      title: context.title,
      targetMinutes: context.config.minutes,
      suggestedTime: context.config.time,
      version: task.version + 1,
      updatedAt: now,
    })
    .where(eq(tasks.id, taskId))
    .run();
  store.db
    .update(taskStudy)
    .set({ cancelled, managedVersion: task.version + 1 })
    .where(eq(taskStudy.taskId, taskId))
    .run();
}
function validScope(store: Store, roadmapId: string, sectionId: string | null) {
  const m = store.db
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
  if (
    !m ||
    m.archived ||
    (sectionId &&
      (!section ||
        section.roadmapId !== m.id ||
        section.deleted ||
        section.archived))
  )
    throw new DomainError("Choose an active roadmap and module.", 409);
  return { m, section };
}
export function mutateStudySchedule(
  store: Store,
  c: StudyScheduleCommand,
  now: number,
) {
  const zone = store.db.select().from(settings).get()!.timezone,
    today = localDate(now, zone);
  if (c.action === "studyTask") {
    const step = c.stepId
      ? store.db
          .select()
          .from(learningSteps)
          .where(eq(learningSteps.id, c.stepId))
          .get()
      : null;
    if (c.stepId && (!step || step.deleted))
      throw new DomainError("Step not found.", 404);
    const section = step
      ? store.db
          .select()
          .from(roadmapSections)
          .where(eq(roadmapSections.id, step.sectionId))
          .get()!
      : null;
    const roadmapId = c.roadmapId ?? section?.roadmapId;
    if (!roadmapId || (section && section.roadmapId !== roadmapId))
      throw new DomainError("Choose a step from this roadmap.");
    const { m } = validScope(store, roadmapId, section?.id ?? null);
    if (c.date < today)
      throw new DomainError("Schedule today or a future date.");
    if (c.startNow && c.date !== today)
      throw new DomainError("Start now uses today's date.");
    ensureOccurrences(store, c.date, c.date, now);
    if (!c.additional) {
      const existing = store.sqlite
        .prepare(
          `SELECT t.id FROM tasks t JOIN task_study x ON x.task_id=t.id LEFT JOIN retired_study_tasks r ON r.task_id=t.id WHERE x.roadmap_id=? AND x.cancelled=0 AND r.task_id IS NULL AND t.planned_date=? AND t.status IN ('pending','in_progress') ORDER BY t.template_id IS NULL,t.created_at,t.id LIMIT 1`,
        )
        .get(m.id, c.date) as { id: string } | undefined;
      if (existing) {
        if (c.stepId !== undefined && !c.startNow) {
          const old = store.db
            .select()
            .from(taskLearning)
            .where(eq(taskLearning.taskId, existing.id))
            .get();
          store.db
            .insert(taskLearning)
            .values({
              taskId: existing.id,
              stepId: step?.id ?? null,
              version: (old?.version ?? 0) + 1,
            })
            .onConflictDoUpdate({
              target: taskLearning.taskId,
              set: {
                stepId: step?.id ?? null,
                version: (old?.version ?? 0) + 1,
              },
            })
            .run();
        }
        return existing.id;
      }
    }
    const id = saveTask(
      store,
      {
        title: m.title,
        category: categories.includes(m.category as (typeof categories)[number])
          ? (m.category as (typeof categories)[number])
          : "Other",
        plannedDate: c.date,
        mode: "flexible",
        suggestedTime: c.time,
        targetMinutes: c.minutes ?? 60,
        fixedStart: null,
        fixedEnd: null,
        optional: false,
        summary: "",
      },
      now,
      zone,
    );
    store.db
      .insert(taskStudy)
      .values({ taskId: id, roadmapId: m.id, sectionId: section?.id ?? null })
      .run();
    store.db
      .insert(taskLearning)
      .values({ taskId: id, stepId: step?.id ?? null })
      .run();
    return id;
  }
  if (c.sectionId !== null && !(c.id && (c.config.paused || c.config.removed)))
    throw new DomainError(
      "Recurring study belongs to the roadmap, not a module.",
    );
  const { m, section } = validScope(store, c.roadmapId, c.sectionId);
  const existing = c.id
    ? store.db
        .select()
        .from(studySchedules)
        .where(eq(studySchedules.id, c.id))
        .get()
    : null;
  if (
    c.id &&
    (!existing ||
      existing.version !== c.version ||
      existing.roadmapId !== c.roadmapId ||
      existing.sectionId !== c.sectionId)
  )
    throw new DomainError("Schedule changed. Reload before saving.", 409);
  if (existing && c.templateId)
    throw new DomainError("An existing schedule cannot be rebound.");
  if (
    !existing &&
    store.db
      .select()
      .from(studySchedules)
      .all()
      .some((s) => s.roadmapId === c.roadmapId && s.sectionId === c.sectionId)
  )
    throw new DomainError(
      "This scope already has a schedule. Edit or restore it.",
      409,
    );
  const id = existing?.id ?? randomUUID(),
    version = (existing?.version ?? 0) + 1;
  if (!existing) {
    const chosen = c.templateId
      ? store.db
          .select()
          .from(templates)
          .where(eq(templates.id, c.templateId))
          .get()
      : null;
    if (
      c.templateId &&
      (!chosen ||
        ["Project", "Applications"].includes(chosen.category) ||
        store.db
          .select()
          .from(studyTemplateLinks)
          .where(eq(studyTemplateLinks.templateId, c.templateId))
          .get())
    )
      throw new DomainError("Choose an unlinked learning activity.", 409);
    if (chosen && !c.config.weekdays.includes(chosen.weekday))
      throw new DomainError(
        "Include the existing activity's weekday when linking it.",
      );
    store.db
      .insert(studySchedules)
      .values({
        id,
        roadmapId: m.id,
        sectionId: c.sectionId,
        createdDate: today,
      })
      .run();
    for (let weekday = 1; weekday <= 7; weekday++) {
      const templateId = chosen?.weekday === weekday ? chosen.id : randomUUID();
      if (templateId !== chosen?.id)
        store.db
          .insert(templates)
          .values({
            id: templateId,
            title: section?.title ?? m.title,
            category:
              chosen?.category ??
              (categories.includes(m.category as (typeof categories)[number])
                ? (m.category as (typeof categories)[number])
                : "Other"),
            weekday,
            targetMinutes: c.config.minutes,
            suggestedTime: c.config.time,
            effectiveFrom: today,
          })
          .run();
      store.db
        .insert(studyTemplateLinks)
        .values({ templateId, scheduleId: id, weekday })
        .run();
    }
  }
  store.db
    .insert(studyScheduleVersions)
    .values({
      id: randomUUID(),
      scheduleId: id,
      version,
      effectiveFrom: today,
      config: c.config,
    })
    .run();
  store.db
    .update(studySchedules)
    .set({ version })
    .where(eq(studySchedules.id, id))
    .run();
  const linked = store.db
    .select()
    .from(studyTemplateLinks)
    .where(eq(studyTemplateLinks.scheduleId, id))
    .all();
  for (const link of linked) {
    for (const task of store.db
      .select()
      .from(tasks)
      .where(eq(tasks.templateId, link.templateId))
      .all()) {
      if (task.occurrenceDate! < today) continue;
      const ctx = scheduleContext(
        store,
        link.templateId,
        task.occurrenceDate!,
      )!;
      applyStudyOccurrence(store, task.id, ctx, now, today);
    }
  }
  return id;
}

export function pauseScopeSchedules(
  store: Store,
  roadmapId: string,
  sectionId: string | null,
  now: number,
) {
  for (const schedule of store.db
    .select()
    .from(studySchedules)
    .where(eq(studySchedules.roadmapId, roadmapId))
    .all()
    .filter((s) => !sectionId || s.sectionId === sectionId)) {
    const config = store.db
      .select()
      .from(studyScheduleVersions)
      .where(eq(studyScheduleVersions.scheduleId, schedule.id))
      .all()
      .sort((a, b) => b.version - a.version)[0].config;
    if (!config.paused && !config.removed)
      mutateStudySchedule(
        store,
        {
          action: "studyScheduleSave",
          id: schedule.id,
          version: schedule.version,
          roadmapId,
          sectionId: schedule.sectionId,
          config: { ...config, paused: true },
        },
        now,
      );
  }
}
