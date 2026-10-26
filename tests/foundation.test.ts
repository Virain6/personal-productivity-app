import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../src/server/db/connection";
import { saveTask, setStatus } from "../src/server/services/tasks";
import { tasks, completions } from "../src/server/db/schema";
const fields = {
  title: "Practice SQL",
  category: "Databases" as const,
  plannedDate: "2026-10-24",
  mode: "flexible" as const,
  suggestedTime: null,
  targetMinutes: 90,
  fixedStart: null,
  fixedEnd: null,
  optional: false,
  summary: "",
};
test("migrations rerun, persisted task survives reconnect, complete and undo retain audit", () => {
  const dir = mkdtempSync(join(tmpdir(), "planner-test-"));
  const path = join(dir, "test.db");
  let store = openDatabase(path);
  try {
    const id = saveTask(store, fields, 1000, "America/Toronto");
    store.sqlite.close();
    store = openDatabase(path);
    assert.equal(store.db.select().from(tasks).all().length, 1);
    setStatus(store, id, 1, "done", false, 2000);
    assert.equal(store.db.select().from(completions).all().length, 1);
    setStatus(store, id, 2, "pending", false, 3000);
    assert.equal(store.db.select().from(completions).get()?.undoneAt, 3000);
    assert.equal(store.db.select().from(tasks).get()?.status, "pending");
    assert.throws(
      () => saveTask(store, fields, 4000, "America/Toronto", id, 1),
      /changed on another device/,
    );
  } finally {
    store.sqlite.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("validate titles, dates, durations and fixed event interval", () => {
  const s = openDatabase(":memory:");
  try {
    assert.throws(() =>
      saveTask(s, { ...fields, title: " " }, 1, "America/Toronto"),
    );
    assert.throws(() =>
      saveTask(
        s,
        { ...fields, plannedDate: "2026-02-30" },
        1,
        "America/Toronto",
      ),
    );
    assert.throws(() =>
      saveTask(s, { ...fields, targetMinutes: 0 }, 1, "America/Toronto"),
    );
    assert.throws(() =>
      saveTask(s, { ...fields, mode: "fixed" }, 1, "America/Toronto"),
    );
  } finally {
    s.sqlite.close();
  }
});
