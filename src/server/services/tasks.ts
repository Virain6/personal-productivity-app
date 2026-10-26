import { eq, and, isNull } from "drizzle-orm";
import { DateTime } from "luxon";
import type { Store } from "../db/connection";
import { tasks, completions, sessions } from "../db/schema";
import { DomainError, taskFields } from "./validation";
import type { z } from "zod";
export function requireTask(store: Store, id: string, version?: number) {
  const task = store.db.select().from(tasks).where(eq(tasks.id, id)).get();
  if (!task) throw new DomainError("Task not found.", 404);
  if (version !== undefined && task.version !== version)
    throw new DomainError(
      "This task changed on another device. Close and reopen it to review the latest version.",
      409,
    );
  return task;
}
export function saveTask(
  store: Store,
  input: z.input<typeof taskFields>,
  now: number,
  timezone: string,
  id?: string,
  version?: number,
) {
  const fields = taskFields.parse(input);
  if (fields.mode === "fixed") {
    if (
      DateTime.fromMillis(fields.fixedStart!, {
        zone: timezone,
      }).toISODate() !== fields.plannedDate
    )
      throw new DomainError("The event start must be on its scheduled date.");
    fields.targetMinutes = Math.max(
      1,
      Math.round((fields.fixedEnd! - fields.fixedStart!) / 60000),
    );
    if (fields.targetMinutes > 1440)
      throw new DomainError("Fixed events are limited to 24 hours.");
  }
  if (id) {
    const old = requireTask(store, id, version);
    store.db
      .update(tasks)
      .set({ ...fields, version: old.version + 1, updatedAt: now })
      .where(eq(tasks.id, id))
      .run();
    return id;
  }
  const newId = crypto.randomUUID();
  store.db
    .insert(tasks)
    .values({ ...fields, id: newId, createdAt: now, updatedAt: now })
    .run();
  return newId;
}
export function setStatus(
  store: Store,
  id: string,
  version: number,
  status: "pending" | "done" | "skipped",
  stopRunning: boolean,
  now: number,
) {
  const task = requireTask(store, id, version);
  const running = store.db
    .select()
    .from(sessions)
    .where(and(eq(sessions.taskId, id), isNull(sessions.endedAt)))
    .get();
  if (running) {
    if (!stopRunning)
      throw new DomainError(
        "Stop this task’s timer before changing its status.",
        409,
      );
    store.db
      .update(sessions)
      .set({ endedAt: Math.max(now, running.startedAt + 1) })
      .where(eq(sessions.id, running.id))
      .run();
  }
  if (task.status === status) return;
  store.db
    .update(completions)
    .set({ undoneAt: now })
    .where(and(eq(completions.taskId, id), isNull(completions.undoneAt)))
    .run();
  if (status === "done")
    store.db
      .insert(completions)
      .values({ id: crypto.randomUUID(), taskId: id, completedAt: now })
      .run();
  store.db
    .update(tasks)
    .set({ status, version: task.version + 1, updatedAt: now })
    .where(eq(tasks.id, id))
    .run();
}
