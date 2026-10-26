import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";
import { openDatabase } from "../src/server/db/connection";
import { seed } from "../src/server/services/scheduling";
import { mutate } from "../src/server/services/mutations";
import { tasks, sessions } from "../src/server/db/schema";
import { getDashboard, getRunning } from "../src/server/services/dashboard";
import { localOptions } from "../src/lib/dates";
const now = Date.parse("2026-10-24T15:00:00Z");
function setup(path = ":memory:") {
  const s = openDatabase(path);
  seed(s, now);
  const fields = {
    title: "Test focus",
    category: "DSA",
    plannedDate: "2026-10-24",
    mode: "flexible",
    suggestedTime: null,
    targetMinutes: 90,
    fixedStart: null,
    fixedEnd: null,
    optional: false,
    summary: "",
  };
  const id = mutate(
    s,
    {
      operationKey: crypto.randomUUID(),
      command: { action: "create", fields },
    },
    now,
  ).id!;
  return { s, id };
}
function cmd(
  s: ReturnType<typeof openDatabase>,
  command: Record<string, unknown>,
  time = now,
) {
  return mutate(s, { operationKey: crypto.randomUUID(), command }, time);
}
test("start/pause/resume, retry-safe stop, independent completion and multiple sessions", () => {
  const { s, id } = setup();
  try {
    const first = cmd(s, { action: "start", id }).id!;
    assert.throws(() => cmd(s, { action: "start", id }), /already running/);
    const stop = {
      operationKey: crypto.randomUUID(),
      command: { action: "stop", sessionId: first },
    };
    mutate(s, stop, now + 60000);
    mutate(s, stop, now + 90000);
    assert.equal(s.db.select().from(sessions).all().length, 1);
    assert.equal(
      s.db.select().from(tasks).where(eq(tasks.id, id)).get()?.status,
      "in_progress",
    );
    const second = cmd(s, { action: "start", id }, now + 120000).id!;
    cmd(s, { action: "stop", sessionId: second }, now + 240000);
    const task = getDashboard(
      s,
      "2026-10-24",
      "2026-10-24",
      now + 300000,
    ).tasks.find((t) => t.id === id)!;
    assert.equal(task.actualMs, 180000);
    assert.equal(task.status, "in_progress");
    assert.equal(getRunning(s).running, null);
  } finally {
    s.sqlite.close();
  }
});
test("active timer survives database restart and finish completion is atomic", () => {
  const dir = mkdtempSync(join(tmpdir(), "planner-timer-"));
  const path = join(dir, "test.db");
  const fixture = setup(path);
  const id = fixture.id;
  let s = fixture.s;
  try {
    const sessionId = cmd(s, { action: "start", id }).id!;
    s.sqlite.close();
    s = openDatabase(path);
    assert.equal(getRunning(s, now + 60000).running?.startedAt, now);
    assert.throws(
      () =>
        cmd(
          s,
          { action: "stop", sessionId, complete: true, version: 999 },
          now + 60000,
        ),
      /changed/,
    );
    assert.equal(getRunning(s).running?.id, sessionId);
    const version = s.db.select().from(tasks).where(eq(tasks.id, id)).get()!
      .version;
    cmd(
      s,
      {
        action: "stop",
        sessionId,
        summary: "Finished joins",
        complete: true,
        version,
      },
      now + 60000,
    );
    assert.equal(
      s.db.select().from(tasks).where(eq(tasks.id, id)).get()?.status,
      "done",
    );
    assert.equal(s.db.select().from(sessions).get()?.summary, "Finished joins");
  } finally {
    s.sqlite.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("manual intervals: invalid/future/overlap protection; no automatic completion", () => {
  const { s, id } = setup();
  try {
    assert.throws(
      () => cmd(s, { action: "manual", id, startedAt: now, endedAt: now - 1 }),
      /positive/,
    );
    assert.throws(
      () => cmd(s, { action: "manual", id, startedAt: now, endedAt: now + 1 }),
      /past/,
    );
    cmd(s, {
      action: "manual",
      id,
      startedAt: now - 120000,
      endedAt: now - 60000,
    });
    assert.throws(
      () =>
        cmd(s, {
          action: "manual",
          id,
          startedAt: now - 90000,
          endedAt: now - 30000,
        }),
      /overlaps/,
    );
    cmd(s, {
      action: "manual",
      id,
      startedAt: now - 90000,
      endedAt: now - 30000,
      overlapConfirmed: true,
    });
    assert.equal(
      s.db.select().from(tasks).where(eq(tasks.id, id)).get()?.status,
      "pending",
    );
    assert.equal(s.db.select().from(sessions).all().length, 2);
  } finally {
    s.sqlite.close();
  }
});
test("cross-midnight allocation and optional exclusion use stored facts", () => {
  const { s, id } = setup();
  try {
    const start = Date.parse("2026-10-25T03:30:00Z");
    const end = Date.parse("2026-10-25T04:30:00Z");
    cmd(s, { action: "manual", id, startedAt: start, endedAt: end }, end + 1);
    const data = getDashboard(s, "2026-10-24", "2026-10-25", end + 1);
    assert.deepEqual(
      data.metrics.days.map((d) => d.trackedMs),
      [1800000, 1800000],
    );
    assert.equal(data.metrics.days[1].required, 0);
    assert.equal(data.metrics.trackedMs, 3600000);
    assert.equal(data.metrics.completed, 0);
  } finally {
    s.sqlite.close();
  }
});
test("manual DST entry rejects missing times and provides both repeated offsets", () => {
  assert.deepEqual(localOptions("2026-03-08T02:30"), []);
  assert.equal(localOptions("2026-11-01T01:30").length, 2);
});
test("two independent processes cannot start two timers", async () => {
  const dir = mkdtempSync(join(tmpdir(), "planner-race-"));
  const path = join(dir, "test.db");
  const { s, id } = setup(path);
  s.sqlite.close();
  try {
    const code = `const {openDatabase}=require('./src/server/db/connection.ts');const {mutate}=require('./src/server/services/mutations.ts');const s=openDatabase(${JSON.stringify(path)});try{mutate(s,{operationKey:crypto.randomUUID(),command:{action:'start',id:${JSON.stringify(id)}}},${now});console.log('started')}catch(e){console.log(e.status===409?'conflict':e.message)}finally{s.sqlite.close()}`;
    const run = promisify(execFile);
    const outcomes = await Promise.all([
      run(process.execPath, ["--import", "tsx", "-e", code]),
      run(process.execPath, ["--import", "tsx", "-e", code]),
    ]);
    assert.deepEqual(outcomes.map((o) => o.stdout.trim()).sort(), [
      "conflict",
      "started",
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
