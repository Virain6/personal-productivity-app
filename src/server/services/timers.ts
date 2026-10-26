import { eq, and, isNull, gt, lt, or } from "drizzle-orm";
import type { Store } from "../db/connection";
import { sessions, tasks } from "../db/schema";
import { requireTask, setStatus } from "./tasks";
import { DomainError } from "./validation";
export function startTimer(store: Store, id: string, now: number) {
  const task = requireTask(store, id);
  if (task.status === "done" || task.status === "skipped")
    throw new DomainError("Reopen the activity before starting a timer.", 409);
  const running = store.db
    .select()
    .from(sessions)
    .where(isNull(sessions.endedAt))
    .get();
  if (running)
    throw new DomainError(
      "A timer is already running. Pause or finish it first.",
      409,
    );
  const sessionId = crypto.randomUUID();
  store.db
    .insert(sessions)
    .values({ id: sessionId, taskId: id, startedAt: now, source: "timer" })
    .run();
  store.db
    .update(tasks)
    .set({ status: "in_progress", version: task.version + 1, updatedAt: now })
    .where(eq(tasks.id, id))
    .run();
  return sessionId;
}
export function stopTimer(
  store: Store,
  sessionId: string,
  summary: string,
  now: number,
  complete = false,
  version?: number,
) {
  const session = store.db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .get();
  if (!session) throw new DomainError("Session not found.", 404);
  if (session.endedAt !== null)
    throw new DomainError(
      "This session already stopped. Refresh before changing it.",
      409,
    );
  if (complete && version === undefined)
    throw new DomainError("Task version is required.");
  store.db
    .update(sessions)
    .set({ endedAt: Math.max(now, session.startedAt + 1), summary })
    .where(eq(sessions.id, sessionId))
    .run();
  if (complete) setStatus(store, session.taskId, version!, "done", false, now);
  return sessionId;
}
export function manualLog(
  store: Store,
  id: string,
  startedAt: number,
  endedAt: number,
  summary: string,
  overlapConfirmed: boolean,
  now: number,
) {
  requireTask(store, id);
  if (endedAt <= startedAt || endedAt > now || startedAt < 0)
    throw new DomainError("Enter a positive interval ending in the past.");
  if (endedAt - startedAt > 7 * 86400000)
    throw new DomainError("A manual session must be shorter than seven days.");
  const overlap = store.db
    .select()
    .from(sessions)
    .where(
      and(
        lt(sessions.startedAt, endedAt),
        or(isNull(sessions.endedAt), gt(sessions.endedAt, startedAt)),
      ),
    )
    .get();
  if (overlap && !overlapConfirmed)
    throw new DomainError(
      "This overlaps recorded or running time. Review the interval and explicitly allow the overlap if intentional.",
      409,
    );
  const sessionId = crypto.randomUUID();
  store.db
    .insert(sessions)
    .values({
      id: sessionId,
      taskId: id,
      startedAt,
      endedAt,
      summary,
      source: "manual",
      overlapConfirmed,
    })
    .run();
  return sessionId;
}
