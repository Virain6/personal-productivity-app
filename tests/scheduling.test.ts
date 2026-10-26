import test from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { openDatabase } from "../src/server/db/connection";
import { seed, ensureOccurrences } from "../src/server/services/scheduling";
import { saveTask, setStatus } from "../src/server/services/tasks";
import { tasks, templates } from "../src/server/db/schema";
import { dayBounds, localDate, weekStart } from "../src/lib/dates";
const now = Date.parse("2026-10-19T15:00:00Z");
test("exact weekly split; idempotent seed and generation; optional Sunday; no invented times", () => {
  const s = openDatabase(":memory:");
  try {
    seed(s, now);
    seed(s, now);
    ensureOccurrences(s, "2026-10-12", "2026-10-25", now);
    ensureOccurrences(s, "2026-10-19", "2026-10-25", now);
    const all = s.db.select().from(tasks).all();
    assert.equal(all.length, 24);
    assert.equal(s.db.select().from(templates).all().length, 24);
    assert.deepEqual(
      [19, 20, 21, 22, 23, 24, 25].map(
        (n) => all.filter((t) => t.plannedDate === `2026-10-${n}`).length,
      ),
      [3, 4, 4, 4, 4, 3, 2],
    );
    assert.ok(
      all.every(
        (t) => t.plannedDate >= "2026-10-19" && t.suggestedTime === null,
      ),
    );
    assert.ok(
      all
        .filter((t) => t.plannedDate === "2026-10-25")
        .every((t) => t.optional),
    );
  } finally {
    s.sqlite.close();
  }
});
test("moving/editing/completing an occurrence survives regeneration and template edits", () => {
  const s = openDatabase(":memory:");
  try {
    seed(s, now);
    ensureOccurrences(s, "2026-10-19", "2026-10-25", now);
    const task = s.db
      .select()
      .from(tasks)
      .where(eq(tasks.templateId, "default-1-dsa"))
      .get()!;
    saveTask(
      s,
      {
        title: "Graphs",
        category: task.category,
        plannedDate: "2026-10-20",
        targetMinutes: 45,
        mode: "flexible",
        suggestedTime: "10:00",
        fixedStart: null,
        fixedEnd: null,
        optional: false,
        summary: "BFS",
      },
      now,
      "America/Toronto",
      task.id,
      task.version,
    );
    setStatus(s, task.id, 2, "done", false, now + 1);
    s.db
      .update(templates)
      .set({ title: "Changed template" })
      .where(eq(templates.id, task.templateId!))
      .run();
    ensureOccurrences(s, "2026-10-19", "2026-10-25", now);
    const updated = s.db
      .select()
      .from(tasks)
      .where(eq(tasks.id, task.id))
      .get()!;
    assert.equal(updated.title, "Graphs");
    assert.equal(updated.plannedDate, "2026-10-20");
    assert.equal(updated.occurrenceDate, "2026-10-19");
    assert.equal(updated.status, "done");
    assert.equal(s.db.select().from(tasks).all().length, 24);
  } finally {
    s.sqlite.close();
  }
});
test("Toronto date boundaries and DST use calendar days, not fixed 24h", () => {
  assert.equal(localDate(Date.parse("2026-10-24T02:00:00Z")), "2026-10-23");
  assert.equal(weekStart("2026-10-25"), "2026-10-19");
  const spring = dayBounds("2026-03-08");
  const fall = dayBounds("2026-11-01");
  assert.equal(spring[1] - spring[0], 23 * 3600000);
  assert.equal(fall[1] - fall[0], 25 * 3600000);
});
