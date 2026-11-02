import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Store } from "../db/connection";
import {
  templates,
  tasks,
  settings,
  studySchedules,
  studyScheduleVersions,
  studyTemplateLinks,
  retiredStudyTasks,
} from "../db/schema";
import { localDate, addDays } from "../../lib/dates";
// Exact seed identities plus original category/title distinguish presets from user tasks.
const defaults: Record<string, [string, string]> = {};
for (let day = 1; day <= 5; day++)
  defaults[`default-${day}-dsa`] = ["DSA", "DSA practice"];
Object.assign(defaults, {
  "default-1-focus": ["Fundamentals", "Computer Science Fundamentals"],
  "default-2-focus": ["Databases", "Databases & SQL"],
  "default-3-focus": ["Interviews", "Mock Interview"],
  "default-4-focus": [
    "System/Backend",
    "System Design & Architecture + Backend Engineering",
  ],
  "default-5-focus": ["Testing/DevOps", "Testing, Debugging & DevOps"],
  "default-3-specialization": [
    "Specialization",
    "Learn on the specialization topic",
  ],
  "default-5-specialization": [
    "Specialization",
    "Review and practice activity",
  ],
  "default-6-dsa": ["DSA", "DSA review"],
  "default-6-focus": ["Fundamentals", "Review weak areas"],
  "default-7-dsa": ["DSA", "Optional DSA"],
});
export function retirementPlan(store: Store, now = Date.now()) {
  const today = localDate(
    now,
    store.db.select().from(settings).get()!.timezone,
  );
  const links = store.db.select().from(studyTemplateLinks).all();
  const legacy = store.db
    .select()
    .from(templates)
    .all()
    .filter((t) => {
      const signature = defaults[t.id];
      return (
        signature &&
        signature[0] === t.category &&
        signature[1] === t.title &&
        Number(t.id.split("-")[1]) === t.weekday &&
        !links.some((l) => l.templateId === t.id)
      );
    });
  const modules = store.db
    .select()
    .from(studySchedules)
    .all()
    .filter((s) => s.sectionId !== null);
  const moduleTemplates = new Set(
    links
      .filter((l) => modules.some((s) => s.id === l.scheduleId))
      .map((l) => l.templateId),
  );
  const legacyIds = new Set(legacy.map((t) => t.id));
  const candidates = store.db
    .select()
    .from(tasks)
    .all()
    .filter(
      (t) =>
        t.templateId &&
        (legacyIds.has(t.templateId) ||
          (moduleTemplates.has(t.templateId) && t.plannedDate >= today)),
    );
  const retiredExists = store.sqlite
    .prepare("SELECT 1 FROM sqlite_master WHERE name='retired_study_tasks'")
    .get();
  const retired = new Set(
    retiredExists
      ? store.db
          .select()
          .from(retiredStudyTasks)
          .all()
          .map((t) => t.taskId)
      : [],
  );
  const eligible = candidates.filter(
    (t) =>
      !retired.has(t.id) &&
      t.status === "pending" &&
      t.version === 1 &&
      !store.sqlite
        .prepare("SELECT 1 FROM time_sessions WHERE task_id=?")
        .get(t.id) &&
      !store.sqlite
        .prepare("SELECT 1 FROM activity_completions WHERE task_id=?")
        .get(t.id) &&
      !store.sqlite
        .prepare("SELECT 1 FROM task_learning WHERE task_id=?")
        .get(t.id),
  );
  // Managed schedule updates increment versions without representing a user edit.
  const managed = candidates.filter(
    (t) =>
      !retired.has(t.id) &&
      !eligible.some((e) => e.id === t.id) &&
      t.status === "pending" &&
      moduleTemplates.has(t.templateId!) &&
      !store.sqlite
        .prepare("SELECT 1 FROM time_sessions WHERE task_id=?")
        .get(t.id) &&
      !store.sqlite
        .prepare("SELECT 1 FROM activity_completions WHERE task_id=?")
        .get(t.id) &&
      !store.sqlite
        .prepare("SELECT 1 FROM task_learning WHERE task_id=?")
        .get(t.id) &&
      store.sqlite
        .prepare(
          "SELECT 1 FROM task_study WHERE task_id=? AND managed_version=?",
        )
        .get(t.id, t.version),
  );
  return {
    today,
    templates: legacy.map((t) => t.id),
    moduleSchedules: modules.map((s) => s.id),
    taskIds: [...eligible, ...managed].map((t) => t.id),
    preserved: candidates
      .filter(
        (t) =>
          !retired.has(t.id) && !eligible.includes(t) && !managed.includes(t),
      )
      .map((t) => t.id),
  };
}
export function retireLearning(store: Store, now = Date.now()) {
  return store.sqlite
    .transaction(() => {
      const plan = retirementPlan(store, now);
      const cutoff = addDays(plan.today, -1);
      for (const id of plan.templates) {
        const template = store.db
          .select()
          .from(templates)
          .where(eq(templates.id, id))
          .get()!;
        if (!template.effectiveUntil || template.effectiveUntil > cutoff)
          store.db
            .update(templates)
            .set({
              effectiveUntil:
                addDays(template.effectiveFrom, -1) < cutoff
                  ? addDays(template.effectiveFrom, -1)
                  : cutoff,
            })
            .where(eq(templates.id, id))
            .run();
      }
      for (const id of plan.moduleSchedules) {
        const schedule = store.db
          .select()
          .from(studySchedules)
          .where(eq(studySchedules.id, id))
          .get()!;
        const latest = store.db
          .select()
          .from(studyScheduleVersions)
          .where(eq(studyScheduleVersions.scheduleId, id))
          .all()
          .sort((a, b) => b.version - a.version)[0];
        if (latest && (!latest.config.paused || !latest.config.removed)) {
          store.db
            .insert(studyScheduleVersions)
            .values({
              id: randomUUID(),
              scheduleId: id,
              version: schedule.version + 1,
              effectiveFrom: plan.today,
              config: { ...latest.config, paused: true, removed: true },
            })
            .run();
          store.db
            .update(studySchedules)
            .set({ version: schedule.version + 1 })
            .where(eq(studySchedules.id, id))
            .run();
        }
      }
      for (const taskId of plan.taskIds)
        store.db
          .insert(retiredStudyTasks)
          .values({ taskId, reason: "roadmap-only-learning", retiredAt: now })
          .onConflictDoNothing()
          .run();
      return plan;
    })
    .immediate();
}
