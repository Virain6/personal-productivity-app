import { mutateHabit } from "./habits";
import { eq } from "drizzle-orm";
import type { Store } from "../db/connection";
import { receipts, settings } from "../db/schema";
import { mutation, DomainError } from "./validation";
import { saveTask, setStatus } from "./tasks";
import {
  startTimer,
  stopTimer,
  manualLog,
  switchTimer,
  correctSession,
} from "./timers";
export function mutate(store: Store, input: unknown, now = Date.now()) {
  const parsed = mutation.parse(input);
  const payload = JSON.stringify(parsed.command);
  return store.sqlite
    .transaction(() => {
      const old = store.db
        .select()
        .from(receipts)
        .where(eq(receipts.key, parsed.operationKey))
        .get();
      if (old) {
        if (old.payload !== payload)
          throw new DomainError(
            "Operation key already used for another request.",
            409,
          );
        return JSON.parse(old.result) as { ok: boolean; id?: string };
      }
      const c = parsed.command;
      const timezone = store.db.select().from(settings).get()!.timezone;
      let id: string | undefined;
      if (
        c.action === "habitCreate" ||
        c.action === "habitEdit" ||
        c.action === "habitArchive" ||
        c.action === "habitNext" ||
        c.action === "habitRecord"
      )
        id = mutateHabit(store, c, now, timezone);
      else if (c.action === "create")
        id = saveTask(store, c.fields, now, timezone);
      else if (c.action === "edit")
        id = saveTask(store, c.fields, now, timezone, c.id, c.version);
      else if (c.action === "status")
        setStatus(store, c.id, c.version, c.status, c.stopRunning, now);
      else if (c.action === "start") id = startTimer(store, c.id, now);
      else if (c.action === "switch")
        id = switchTimer(store, c.sessionId, c.id, now);
      else if (c.action === "correctSession")
        id = correctSession(
          store,
          c.id,
          c.expected,
          c.startedAt,
          c.endedAt,
          c.summary,
          c.overlapConfirmed,
          now,
        );
      else if (c.action === "stop")
        id = stopTimer(
          store,
          c.sessionId,
          c.summary,
          now,
          c.complete,
          c.version,
        );
      else if (c.action === "manual")
        id = manualLog(
          store,
          c.id,
          c.startedAt,
          c.endedAt,
          c.summary,
          c.overlapConfirmed,
          now,
        );
      const result = { ok: true, id };
      store.db
        .insert(receipts)
        .values({
          key: parsed.operationKey,
          payload,
          result: JSON.stringify(result),
          createdAt: now,
        })
        .run();
      return result;
    })
    .immediate();
}
