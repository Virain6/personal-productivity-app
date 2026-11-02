import { pauseScopeSchedules } from "./study-schedules";
import { randomUUID } from "node:crypto";
import { and, eq, asc } from "drizzle-orm";
import type { Store } from "../db/connection";
import {
  roadmaps,
  roadmapSections,
  learningSteps,
  settings,
  sessions,
  sessionLearning,
} from "../db/schema";
import { DomainError } from "./validation";
import type { LearningCommand } from "./learning-validation";
import {
  learningCategories,
  type LearningData,
} from "../../lib/learning-types";
import { localDate } from "../../lib/dates";
export function getLearning(store: Store): LearningData {
  return store.sqlite.transaction(() => {
    const maps = store.db
      .select()
      .from(roadmaps)
      .orderBy(asc(roadmaps.createdAt), asc(roadmaps.id))
      .all();
    const sections = store.db
      .select()
      .from(roadmapSections)
      .where(eq(roadmapSections.deleted, false))
      .orderBy(asc(roadmapSections.position), asc(roadmapSections.id))
      .all();
    const steps = store.db
      .select()
      .from(learningSteps)
      .where(eq(learningSteps.deleted, false))
      .orderBy(asc(learningSteps.position), asc(learningSteps.id))
      .all();
    const timezone = store.db.select().from(settings).get()!.timezone;
    const time = store.sqlite
      .prepare(
        "SELECT t.category, sum(s.ended_at-s.started_at) AS trackedMs, max(s.ended_at) AS lastStudied FROM time_sessions s JOIN tasks t ON t.id=s.task_id WHERE s.ended_at IS NOT NULL GROUP BY t.category",
      )
      .all() as { category: string; trackedMs: number; lastStudied: number }[];
    return {
      timezone,
      studyHistory: store.db
        .select({
          sessionId: sessions.id,
          startedAt: sessions.startedAt,
          endedAt: sessions.endedAt,
          summary: sessions.summary,
          stepId: sessionLearning.stepId,
          roadmapId: sessionLearning.roadmapId,
          sectionId: sessionLearning.sectionId,
          roadmapTitle: sessionLearning.roadmapTitle,
          sectionTitle: sessionLearning.sectionTitle,
          stepTitle: sessionLearning.stepTitle,
          version: sessionLearning.version,
        })
        .from(sessionLearning)
        .innerJoin(sessions, eq(sessions.id, sessionLearning.sessionId))
        .all()
        .filter((s) => s.roadmapId !== null)
        .sort((a, b) => b.startedAt - a.startedAt),
      roadmaps: maps.map((m) => ({
        ...m,
        sections: sections
          .filter((s) => s.roadmapId === m.id)
          .map((s) => ({
            ...s,
            steps: steps.filter((step) => step.sectionId === s.id),
          })),
      })),
      categories: learningCategories.map((category) => {
        const row = time.find((t) => t.category === category);
        return {
          category,
          trackedMs: row?.trackedMs ?? 0,
          lastStudied: row ? localDate(row.lastStudied, timezone) : null,
        };
      }),
    };
  })();
}
export function mutateLearning(
  store: Store,
  c: LearningCommand,
  now: number,
): string {
  if (c.action === "roadmapCreate") {
    const id = randomUUID();
    store.db
      .insert(roadmaps)
      .values({
        id,
        title: c.title,
        category: c.category ?? "Other",
        color: c.color,
        description: c.description,
        goal: c.goal,
        targetDate: c.targetDate,
        createdAt: now,
      })
      .run();
    return id;
  }
  const m = store.db.select().from(roadmaps).where(eq(roadmaps.id, c.id)).get();
  if (!m) throw new DomainError("Roadmap not found.", 404);
  if (m.version !== c.version)
    throw new DomainError("Roadmap changed. Reload before editing.", 409);
  const o = c.operation;
  if (m.archived && o.kind !== "archive" && o.kind !== "edit")
    throw new DomainError("Restore this roadmap before editing.", 409);
  const sections = store.db
    .select()
    .from(roadmapSections)
    .where(
      and(
        eq(roadmapSections.roadmapId, m.id),
        eq(roadmapSections.deleted, false),
      ),
    )
    .all();
  const section = (id: string) => {
    const s = sections.find((s) => s.id === id);
    if (!s) throw new DomainError("Section is not in this roadmap.", 404);
    if (s.archived)
      throw new DomainError("Restore this module before editing.", 409);
    return s;
  };
  const step = (id: string) => {
    const s = store.db
      .select()
      .from(learningSteps)
      .where(and(eq(learningSteps.id, id), eq(learningSteps.deleted, false)))
      .get();
    if (!s) throw new DomainError("Step not found.", 404);
    section(s.sectionId);
    return s;
  };
  let current = m.currentStepId;
  if (o.kind === "edit")
    store.db
      .update(roadmaps)
      .set({
        title: o.title,
        category: o.category,
        color: o.color,
        description: o.description,
        goal: o.goal,
        targetDate: o.targetDate,
      })
      .where(eq(roadmaps.id, m.id))
      .run();
  else if (o.kind === "archive") {
    if (o.archived) pauseScopeSchedules(store, m.id, null, now);
    store.db
      .update(roadmaps)
      .set({ archived: o.archived })
      .where(eq(roadmaps.id, m.id))
      .run();
  } else if (o.kind === "sectionArchive") {
    const s = sections.find((s) => s.id === o.id);
    if (!s) throw new DomainError("Module not found.", 404);
    if (o.archived) {
      pauseScopeSchedules(store, m.id, s.id, now);
      if (
        current &&
        store.db
          .select()
          .from(learningSteps)
          .where(eq(learningSteps.id, current))
          .get()?.sectionId === s.id
      )
        current = null;
    }
    store.db
      .update(roadmapSections)
      .set({ archived: o.archived })
      .where(eq(roadmapSections.id, s.id))
      .run();
  } else if (o.kind === "sectionAdd")
    store.db
      .insert(roadmapSections)
      .values({
        id: randomUUID(),
        roadmapId: m.id,
        title: o.title,
        description: o.description,
        objective: o.objective,
        resourceUrl: o.resourceUrl,
        position: Math.max(-1, ...sections.map((s) => s.position)) + 1,
      })
      .run();
  else if (o.kind === "sectionEdit" || o.kind === "sectionDelete") {
    section(o.id);
    if (o.kind === "sectionDelete") pauseScopeSchedules(store, m.id, o.id, now);
    store.db
      .update(roadmapSections)
      .set(
        o.kind === "sectionEdit"
          ? {
              title: o.title,
              description: o.description,
              objective: o.objective,
              resourceUrl: o.resourceUrl,
            }
          : { deleted: true },
      )
      .where(eq(roadmapSections.id, o.id))
      .run();
    if (
      o.kind === "sectionDelete" &&
      current &&
      store.db
        .select()
        .from(learningSteps)
        .where(eq(learningSteps.id, current))
        .get()?.sectionId === o.id
    )
      current = null;
  } else if (o.kind === "stepAdd") {
    section(o.sectionId);
    const siblings = store.db
      .select()
      .from(learningSteps)
      .where(eq(learningSteps.sectionId, o.sectionId))
      .all();
    store.db
      .insert(learningSteps)
      .values({
        id: randomUUID(),
        sectionId: o.sectionId,
        title: o.title,
        resourceUrl: o.resourceUrl,
        description: o.description,
        objective: o.objective,
        position: Math.max(-1, ...siblings.map((s) => s.position)) + 1,
      })
      .run();
  } else if (
    o.kind === "stepEdit" ||
    o.kind === "stepDelete" ||
    o.kind === "complete" ||
    o.kind === "status"
  ) {
    step(o.id);
    store.db
      .update(learningSteps)
      .set(
        o.kind === "stepEdit"
          ? {
              title: o.title,
              resourceUrl: o.resourceUrl,
              description: o.description,
              objective: o.objective,
            }
          : o.kind === "stepDelete"
            ? { deleted: true }
            : o.kind === "status"
              ? { status: o.status, completed: o.status === "completed" }
              : {
                  completed: o.completed,
                  status: o.completed ? "completed" : "not_started",
                },
      )
      .where(eq(learningSteps.id, o.id))
      .run();
    if (o.kind === "stepDelete" && current === o.id) current = null;
  } else if (o.kind === "current") {
    if (o.id) step(o.id);
    current = o.id;
  } else if (o.kind === "reorder") {
    if (o.sectionId) section(o.sectionId);
    const table = o.sectionId ? learningSteps : roadmapSections;
    const expected = o.sectionId
      ? store.db
          .select()
          .from(learningSteps)
          .where(
            and(
              eq(learningSteps.sectionId, o.sectionId),
              eq(learningSteps.deleted, false),
            ),
          )
          .all()
      : sections;
    if (
      o.ids.length !== expected.length ||
      new Set(o.ids).size !== expected.length ||
      expected.some((s) => !o.ids.includes(s.id))
    )
      throw new DomainError(
        "Reorder must include every current item exactly once.",
        409,
      );
    o.ids.forEach((id, position) =>
      store.db.update(table).set({ position }).where(eq(table.id, id)).run(),
    );
  }
  store.db
    .update(roadmaps)
    .set({ version: m.version + 1, currentStepId: current })
    .where(eq(roadmaps.id, m.id))
    .run();
  return m.id;
}
