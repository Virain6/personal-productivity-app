import { eq, desc } from "drizzle-orm";
import type { Store } from "../db/connection";
import {
  generalTemplateVersions,
  templates,
  studyTemplateLinks,
  settings,
} from "../db/schema";
import type {
  GeneralScheduleConfig,
  GeneralScheduleData,
} from "../../lib/general-schedule";
import { localDate } from "../../lib/dates";
import { DomainError } from "./validation";
import type { CalendarCommand } from "./calendar-validation";
export function templateConfig(
  store: Store,
  template: typeof templates.$inferSelect,
  date: string,
): GeneralScheduleConfig {
  const revision = store.db
    .select()
    .from(generalTemplateVersions)
    .where(eq(generalTemplateVersions.templateId, template.id))
    .orderBy(desc(generalTemplateVersions.version))
    .all()
    .find((v) => v.effectiveFrom <= date);
  return (
    revision?.config ?? {
      title: template.title,
      summary: "",
      weekday: template.weekday,
      time: template.suggestedTime,
      minutes: template.targetMinutes,
      optional: template.optional,
    }
  );
}
export function getGeneralSchedule(
  store: Store,
  id: string,
  now = Date.now(),
): GeneralScheduleData {
  const t = store.db.select().from(templates).where(eq(templates.id, id)).get();
  if (!t) throw new DomainError("Recurring activity not found.", 404);
  if (
    store.db
      .select()
      .from(studyTemplateLinks)
      .where(eq(studyTemplateLinks.templateId, id))
      .get() ||
    !["Other", "Project", "Applications"].includes(t.category)
  )
    throw new DomainError("Edit learning recurrence from its roadmap.");
  if (t.effectiveUntil)
    throw new DomainError("This old recurring activity has ended.");
  const latest = store.db
    .select()
    .from(generalTemplateVersions)
    .where(eq(generalTemplateVersions.templateId, id))
    .orderBy(desc(generalTemplateVersions.version))
    .get();
  const today = localDate(
    now,
    store.db.select().from(settings).get()!.timezone,
  );
  return {
    templateId: id,
    version: latest?.version ?? 0,
    effectiveFrom: latest?.effectiveFrom ?? t.effectiveFrom,
    today,
    config: latest?.config ?? templateConfig(store, t, today),
  };
}
export function saveGeneralSchedule(
  store: Store,
  c: Extract<CalendarCommand, { action: "generalScheduleSave" }>,
  now: number,
) {
  const today = localDate(
    now,
    store.db.select().from(settings).get()!.timezone,
  );
  if (c.effectiveFrom < today)
    throw new DomainError("Future schedule changes must start today or later.");
  const id = c.templateId ?? crypto.randomUUID();
  if (c.templateId) {
    const old = getGeneralSchedule(store, id, now);
    if (old.version !== c.version)
      throw new DomainError(
        "The schedule changed. Close and reopen to review the latest version.",
        409,
      );
    if (c.effectiveFrom < old.effectiveFrom)
      throw new DomainError(
        "Choose a date on or after the latest schedule revision.",
      );
  } else {
    if (c.version !== 0)
      throw new DomainError("A new schedule starts at version zero.");
    store.db
      .insert(templates)
      .values({
        id,
        title: c.config.title,
        category: "Other",
        weekday: c.config.weekday,
        targetMinutes: c.config.minutes,
        suggestedTime: c.config.time,
        optional: c.config.optional,
        effectiveFrom: c.effectiveFrom,
      })
      .run();
  }
  store.db
    .insert(generalTemplateVersions)
    .values({
      id: crypto.randomUUID(),
      templateId: id,
      version: c.version + 1,
      effectiveFrom: c.effectiveFrom,
      config: c.config,
    })
    .run();
  // Regenerate only untouched future projections. Anything edited, moved,
  // completed, skipped, attributed or timed retains its identity and history.
  store.sqlite
    .prepare(
      `DELETE FROM tasks WHERE template_id=? AND occurrence_date>=? AND planned_date>=? AND status='pending' AND version=1 AND planned_date=occurrence_date
    AND NOT EXISTS(SELECT 1 FROM time_sessions s WHERE s.task_id=tasks.id)
    AND NOT EXISTS(SELECT 1 FROM activity_completions c WHERE c.task_id=tasks.id)
    AND NOT EXISTS(SELECT 1 FROM task_learning l WHERE l.task_id=tasks.id)
    AND NOT EXISTS(SELECT 1 FROM task_study s WHERE s.task_id=tasks.id)
    AND NOT EXISTS(SELECT 1 FROM retired_study_tasks r WHERE r.task_id=tasks.id)`,
    )
    .run(id, c.effectiveFrom, c.effectiveFrom);
  return id;
}
