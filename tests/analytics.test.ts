import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { openDatabase, type Store } from "../src/server/db/connection";
import {
  tasks,
  sessions,
  roadmaps,
  roadmapSections,
  learningSteps,
  sessionLearning,
  taskStudy,
  retiredStudyTasks,
  templates,
  settings,
} from "../src/server/db/schema";
import { seed } from "../src/server/services/scheduling";
import { getAnalytics } from "../src/server/services/analytics";
import { getDashboard } from "../src/server/services/dashboard";
import { mutate } from "../src/server/services/mutations";
import {
  presetRange,
  shiftRange,
  rangeError,
} from "../src/lib/analytics-range";
const now = Date.parse("2026-10-29T18:00:00Z");
const range = { from: "2026-10-26", to: "2026-11-01" };
const hour = 3600000;
function setup() {
  const s = openDatabase(":memory:");
  seed(s, Date.parse("2026-01-01T12:00:00Z"));
  s.db.delete(templates).run();
  s.db
    .insert(roadmaps)
    .values({
      id: "map",
      title: "Systems",
      category: "Other",
      color: "blue",
      createdAt: now,
    })
    .run();
  s.db
    .insert(roadmapSections)
    .values({ id: "module", roadmapId: "map", title: "Memory", position: 0 })
    .run();
  s.db
    .insert(learningSteps)
    .values({ id: "step", sectionId: "module", title: "Paging", position: 0 })
    .run();
  return s;
}
function task(
  s: Store,
  date = "2026-10-26",
  status: "pending" | "done" | "skipped" = "pending",
  optional = false,
  study = true,
) {
  const id = randomUUID();
  s.db
    .insert(tasks)
    .values({
      id,
      plannedDate: date,
      status,
      optional,
      title: "Study",
      category: "Other",
      targetMinutes: 60,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  if (study)
    s.db.insert(taskStudy).values({ taskId: id, roadmapId: "map" }).run();
  return id;
}
function session(
  s: Store,
  taskId: string,
  from: string,
  to: string | null,
  linked = true,
  module = true,
  source: "timer" | "manual" = "timer",
) {
  const id = randomUUID();
  s.db
    .insert(sessions)
    .values({
      id,
      taskId,
      startedAt: Date.parse(from),
      endedAt: to ? Date.parse(to) : null,
      source,
    })
    .run();
  if (linked)
    s.db
      .insert(sessionLearning)
      .values({
        sessionId: id,
        roadmapId: "map",
        sectionId: module ? "module" : null,
        stepId: module ? "step" : null,
        roadmapTitle: "Systems",
        sectionTitle: "Memory",
        stepTitle: "Paging",
      })
      .run();
  return id;
}
test("analytics ranges handle Monday weeks, leap months, year boundaries and bounded custom dates", () => {
  assert.deepEqual(presetRange("week", "2027-01-01"), {
    from: "2026-12-28",
    to: "2027-01-03",
  });
  assert.deepEqual(presetRange("lastWeek", "2027-01-01"), {
    from: "2026-12-21",
    to: "2026-12-27",
  });
  assert.deepEqual(shiftRange(presetRange("month", "2028-01-31"), "month", 1), {
    from: "2028-02-01",
    to: "2028-02-29",
  });
  assert.deepEqual(
    shiftRange({ from: "2026-12-30", to: "2027-01-02" }, "custom", 1),
    { from: "2027-01-03", to: "2027-01-06" },
  );
  assert.ok(rangeError({ from: "2026-02-30", to: "2026-03-01" }));
  assert.ok(rangeError({ from: "2026-03-02", to: "2026-03-01" }));
  assert.ok(rangeError({ from: "2026-01-01", to: "2026-04-04" }));
  assert.equal(rangeError({ from: "2026-01-01", to: "2026-04-03" }), "");
});
test("empty data has truthful zeros, no completion percentage, comparison or fabricated mastery", () => {
  const s = setup();
  try {
    const data = getAnalytics(s, range, now);
    assert.equal(data.summary.studyMs, 0);
    assert.equal(data.summary.completionRate, null);
    assert.equal(data.previous, null);
    assert.equal(data.days.length, 7);
    assert.equal(data.trend.length, 8);
    assert.equal(data.roadmaps[0].modules[0].completed, 0);
    assert.throws(
      () => getAnalytics(s, { from: "bad", to: "bad" }, now),
      /valid/,
    );
    assert.throws(
      () => getAnalytics(s, { from: "2020-01-01", to: "2026-01-01" }, now),
      /93/,
    );
  } finally {
    s.sqlite.close();
  }
});
test("saved timer/manual durations aggregate once, running time and unlinked time remain distinct", () => {
  const s = setup();
  try {
    const id = task(s);
    session(s, id, "2026-10-26T14:00:00Z", "2026-10-26T15:00:00Z");
    session(
      s,
      id,
      "2026-10-26T16:00:00Z",
      "2026-10-26T16:30:00Z",
      true,
      false,
      "manual",
    );
    session(s, id, "2026-10-26T17:00:00Z", "2026-10-26T18:00:00Z", false);
    session(s, id, "2026-10-29T17:00:00Z", null);
    const before = s.sqlite.prepare("SELECT * FROM time_sessions").all();
    const data = getAnalytics(s, range, now);
    assert.equal(data.summary.studyMs, 1.5 * hour);
    assert.equal(data.summary.trackedMs, 2.5 * hour);
    assert.equal(data.summary.studySessions, 2);
    assert.equal(data.summary.plannedMs, hour);
    assert.equal(data.roadmaps[0].modules[0].studyMs, hour);
    assert.equal(data.roadmaps[0].studyMs, 1.5 * hour);
    assert.equal(data.trend.at(-1)!.studyMs, 1.5 * hour);
    assert.deepEqual(
      s.sqlite.prepare("SELECT * FROM time_sessions").all(),
      before,
    );
    assert.equal(
      s.db.select().from(learningSteps).get()!.status,
      "not_started",
    );
  } finally {
    s.sqlite.close();
  }
});
test("completion does not fabricate time; skipped, future, optional, retired and cancelled tasks use explicit denominators", () => {
  const s = setup();
  try {
    task(s, "2026-10-26", "done");
    task(s, "2026-10-27", "skipped");
    task(s, "2026-10-28");
    task(s, "2026-10-29");
    task(s, "2026-10-30");
    task(s, "2026-10-26", "done", true, false);
    task(s, "2026-10-26", "pending", true);
    const cancelled = task(s),
      retired = task(s);
    s.db
      .update(taskStudy)
      .set({ cancelled: true })
      .where(eq(taskStudy.taskId, cancelled))
      .run();
    s.db
      .insert(retiredStudyTasks)
      .values({ taskId: retired, reason: "legacy", retiredAt: now })
      .run();
    const data = getAnalytics(s, range, now);
    assert.equal(data.summary.studyMs, 0);
    assert.equal(data.summary.plannedMs, 6 * hour);
    assert.equal(data.summary.completedTasks, 2);
    assert.equal(data.summary.requiredTasks, 4);
    assert.equal(data.summary.completionRate, 25);
    assert.deepEqual(data.summary.studyTasks, {
      completed: 1,
      skipped: 1,
      missed: 1,
      open: 2,
      upcoming: 1,
    });
  } finally {
    s.sqlite.close();
  }
});
test("cross-midnight sessions split time but are counted once on their local start date", () => {
  const s = setup();
  try {
    session(s, task(s), "2026-10-27T03:30:00Z", "2026-10-27T05:00:00Z");
    const full = getAnalytics(s, range, now);
    assert.equal(full.days[0].studyMs, 0.5 * hour);
    assert.equal(full.days[1].studyMs, hour);
    assert.equal(full.days[0].studySessions, 1);
    assert.equal(full.days[1].studySessions, 0);
    const partial = getAnalytics(
      s,
      { from: "2026-10-27", to: "2026-10-27" },
      now,
    );
    assert.equal(partial.summary.studyMs, hour);
    assert.equal(partial.summary.studySessions, 0);
  } finally {
    s.sqlite.close();
  }
});
test("Toronto spring and autumn daylight-saving days use real elapsed durations", () => {
  const s = setup();
  try {
    const id = task(s);
    session(s, id, "2026-03-08T05:00:00Z", "2026-03-09T04:00:00Z");
    session(s, id, "2026-11-01T04:00:00Z", "2026-11-02T05:00:00Z");
    const later = Date.parse("2026-11-03T18:00:00Z");
    assert.equal(
      getAnalytics(s, { from: "2026-03-08", to: "2026-03-08" }, later).summary
        .studyMs,
      23 * hour,
    );
    assert.equal(
      getAnalytics(s, { from: "2026-11-01", to: "2026-11-01" }, later).summary
        .studyMs,
      25 * hour,
    );
    s.db.update(settings).set({ timezone: "UTC" }).run();
    assert.equal(
      getAnalytics(s, { from: "2026-11-01", to: "2026-11-01" }, later).summary
        .studyMs,
      20 * hour,
    );
  } finally {
    s.sqlite.close();
  }
});
test("roadmap/module rename and archive retain stable historical attribution and mastery stays separate", () => {
  const s = setup();
  try {
    const id = task(s);
    session(s, id, "2026-10-26T14:00:00Z", "2026-10-26T15:00:00Z");
    const snapshots = s.sqlite.prepare("SELECT * FROM session_learning").all();
    s.db.update(roadmaps).set({ title: "Renamed", archived: true }).run();
    s.db
      .update(roadmapSections)
      .set({ title: "Renamed module", archived: true, position: 4 })
      .run();
    s.db
      .update(learningSteps)
      .set({ completed: true, status: "completed" })
      .run();
    const data = getAnalytics(s, range, now);
    assert.equal(data.roadmaps[0].title, "Renamed");
    assert.equal(data.roadmaps[0].archived, true);
    assert.equal(data.roadmaps[0].studyMs, hour);
    assert.equal(data.roadmaps[0].modules[0].completed, 1);
    assert.deepEqual(
      s.sqlite.prepare("SELECT * FROM session_learning").all(),
      snapshots,
    );
    s.db
      .update(sessionLearning)
      .set({ roadmapId: null, sectionId: null, stepId: null })
      .run();
    assert.equal(getAnalytics(s, range, now).summary.studyMs, 0);
    assert.equal(getAnalytics(s, range, now).summary.trackedMs, hour);
  } finally {
    s.sqlite.close();
  }
});
test("partial current periods compare matching elapsed local days only when prior records exist", () => {
  const s = setup();
  try {
    const id = task(s);
    session(s, id, "2026-10-19T14:00:00Z", "2026-10-19T15:00:00Z");
    session(s, id, "2026-10-23T14:00:00Z", "2026-10-23T18:00:00Z");
    const data = getAnalytics(s, range, now);
    assert.deepEqual(data.previous, {
      from: "2026-10-19",
      to: "2026-10-22",
      studyMs: hour,
      trackedMs: hour,
      hasStudy: true,
    });
    assert.equal(
      getAnalytics(s, { from: "2026-11-09", to: "2026-11-15" }, now).previous,
      null,
    );
  } finally {
    s.sqlite.close();
  }
});
test("Analytics and Home share recurrence identities, edits and saved timer outcomes without duplicate tasks", () => {
  const s = setup();
  try {
    const send = (command: unknown) =>
      mutate(s, { operationKey: randomUUID(), command }, now).id!;
    const map = send({
      action: "roadmapCreate",
      title: "SQL",
      schedule: {
        weekdays: [4, 5],
        minutes: 45,
        time: null,
        paused: false,
        removed: false,
      },
    });
    const first = getAnalytics(s, range, now);
    assert.equal(first.summary.plannedMs, 90 * 60000);
    const count = s.db.select().from(tasks).all().length;
    getAnalytics(s, range, now);
    getDashboard(s, range.from, range.to, now);
    assert.equal(
      s.db
        .select()
        .from(tasks)
        .all()
        .filter((t) => t.plannedDate >= range.from && t.plannedDate <= range.to)
        .length,
      count,
    );
    const today = s.db
      .select()
      .from(tasks)
      .all()
      .find((t) => t.plannedDate === "2026-10-29")!;
    send({
      action: "manual",
      id: today.id,
      startedAt: now - hour,
      endedAt: now - hour / 2,
      overlapConfirmed: false,
      summary: "",
    });
    const data = getAnalytics(s, range, now);
    assert.equal(data.summary.studyMs, hour / 2);
    assert.equal(data.roadmaps.find((r) => r.id === map)!.studyMs, hour / 2);
    assert.equal(
      getDashboard(s, range.from, range.to, now).tasks.find(
        (t) => t.id === today.id,
      )!.actualMs,
      hour / 2,
    );
    s.db
      .update(tasks)
      .set({ plannedDate: "2026-11-02", version: 2 })
      .where(eq(tasks.id, today.id))
      .run();
    assert.equal(getAnalytics(s, range, now).summary.plannedMs, 45 * 60000);
    assert.equal(getAnalytics(s, range, now).summary.studyMs, hour / 2);
  } finally {
    s.sqlite.close();
  }
});
