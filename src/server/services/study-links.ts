import { recommendedStep } from "./study-schedules";
import { eq } from "drizzle-orm";
import type { Store } from "../db/connection";
import {
  learningSteps,
  roadmapSections,
  roadmaps,
  sessions,
  taskLearning,
  sessionLearning,
  taskStudy,
} from "../db/schema";
import { requireTask } from "./tasks";
import { DomainError } from "./validation";

export function studyTopic(store: Store, stepId: string) {
  const step = store.db
    .select()
    .from(learningSteps)
    .where(eq(learningSteps.id, stepId))
    .get();
  const section =
    step &&
    store.db
      .select()
      .from(roadmapSections)
      .where(eq(roadmapSections.id, step.sectionId))
      .get();
  const map =
    section &&
    store.db
      .select()
      .from(roadmaps)
      .where(eq(roadmaps.id, section.roadmapId))
      .get();
  if (!step || !section || !map)
    throw new DomainError("Learning step not found.", 404);
  return {
    stepId,
    roadmapId: map.id,
    roadmapTitle: map.title,
    sectionId: section.id,
    sectionTitle: section.title,
    stepTitle: step.title,
    category: map.category,
    available:
      !step.deleted && !section.deleted && !section.archived && !map.archived,
  };
}
export function taskTopic(store: Store, taskId: string) {
  const link = store.db
    .select()
    .from(taskLearning)
    .where(eq(taskLearning.taskId, taskId))
    .get();
  const scope = !link
    ? store.db
        .select()
        .from(taskStudy)
        .where(eq(taskStudy.taskId, taskId))
        .get()
    : null;
  const recommendation =
    scope && !scope.cancelled
      ? recommendedStep(store, scope.roadmapId, scope.sectionId)
      : null;
  return {
    version: link?.version ?? 0,
    topic: link
      ? link.stepId
        ? studyTopic(store, link.stepId)
        : null
      : recommendation
        ? studyTopic(store, recommendation.id)
        : null,
  };
}
function validTopic(store: Store, stepId: string) {
  const topic = studyTopic(store, stepId);
  if (!topic.available)
    throw new DomainError("Choose an active learning step.", 409);
  return topic;
}
export function setTaskTopic(
  store: Store,
  taskId: string,
  stepId: string | null,
  version: number,
) {
  requireTask(store, taskId);
  const old = taskTopic(store, taskId);
  if (version !== old.version)
    throw new DomainError("Activity topic changed. Reload before saving.", 409);
  if (stepId) validTopic(store, stepId);
  store.db
    .insert(taskLearning)
    .values({ taskId, stepId, version: version + 1 })
    .onConflictDoUpdate({
      target: taskLearning.taskId,
      set: { stepId, version: version + 1 },
    })
    .run();
  return taskId;
}
export function setSessionTopic(
  store: Store,
  sessionId: string,
  stepId: string | null,
  version: number,
) {
  const session = store.db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .get();
  if (!session) throw new DomainError("Session not found.", 404);
  const old = store.db
    .select()
    .from(sessionLearning)
    .where(eq(sessionLearning.sessionId, sessionId))
    .get();
  if ((old?.version ?? 0) !== version)
    throw new DomainError("Session topic changed. Reload before saving.", 409);
  // Keeping the same historical link never rewrites its labels after a rename/archive.
  if (old?.stepId === stepId && (stepId !== null || old.roadmapId === null))
    return sessionId;
  const topic = stepId ? validTopic(store, stepId) : null;
  const fields = {
    stepId,
    roadmapId: topic?.roadmapId ?? null,
    sectionId: topic?.sectionId ?? null,
    roadmapTitle: topic?.roadmapTitle ?? "",
    sectionTitle: topic?.sectionTitle ?? "",
    stepTitle: topic?.stepTitle ?? "",
    version: version + 1,
  };
  store.db
    .insert(sessionLearning)
    .values({ sessionId, ...fields })
    .onConflictDoUpdate({ target: sessionLearning.sessionId, set: fields })
    .run();
  return sessionId;
}
export function linkNewSession(
  store: Store,
  sessionId: string,
  explicit?: string | null,
) {
  const session = store.db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .get()!;
  let stepId = explicit;
  if (stepId === undefined) {
    const topic = taskTopic(store, session.taskId).topic;
    // Archived/deleted defaults must never prevent ordinary time logging.
    stepId = topic?.available ? topic.stepId : null;
  }
  if (stepId) setSessionTopic(store, sessionId, stepId, 0);
  else {
    const scope = store.db
      .select()
      .from(taskStudy)
      .where(eq(taskStudy.taskId, session.taskId))
      .get();
    const map =
      scope &&
      store.db
        .select()
        .from(roadmaps)
        .where(eq(roadmaps.id, scope.roadmapId))
        .get();
    const section = scope?.sectionId
      ? store.db
          .select()
          .from(roadmapSections)
          .where(eq(roadmapSections.id, scope.sectionId))
          .get()
      : null;
    if (
      scope &&
      !scope.cancelled &&
      map &&
      !map.archived &&
      (!section || (!section.archived && !section.deleted))
    )
      store.db
        .insert(sessionLearning)
        .values({
          sessionId,
          roadmapId: map.id,
          sectionId: scope.sectionId,
          roadmapTitle: map.title,
          sectionTitle: section?.title ?? "",
        })
        .run();
  }
}
