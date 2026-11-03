import test from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import {
  summarizeHabitActivity,
  expectedHabitDate,
} from "../src/lib/activity-analytics";
import { addDays } from "../src/lib/dates";
import type {
  HabitConfig,
  HabitDay,
  HabitRecord,
} from "../src/lib/habit-types";
import { openDatabase } from "../src/server/db/connection";
import { seed } from "../src/server/services/scheduling";
import { getAnalytics } from "../src/server/services/analytics";
import {
  habits,
  habitRecords,
  habitRevisions,
  roadmaps,
  roadmapSections,
  learningSteps,
  tasks,
  taskStudy,
  sessions,
  sessionLearning,
} from "../src/server/db/schema";
const cfg: HabitConfig = {
  name: "Read",
  kind: "binary",
  direction: "build",
  unit: "",
  goal: "awareness",
  target: null,
  schedule: "daily",
  weekdays: [],
  timesPerWeek: 3,
  rotation: [],
};
const record = (
  date: string,
  state: HabitRecord["state"] = "done",
  quantityMilli: number | null = null,
  workout = "",
): HabitRecord => ({
  id: date,
  habitId: "h",
  date,
  revisionId: "v1",
  version: 1,
  state,
  quantityMilli,
  workout,
  plannedWorkout: "Push",
  advancedFrom: null,
  advanceCursor: null,
  updatedAt: 0,
});
function days(
  config: HabitConfig = cfg,
  entries: HabitRecord[] = [],
  from = "2026-10-26",
  count = 7,
): HabitDay[] {
  return Array.from({ length: count }, (_, i) => {
    const date = addDays(from, i);
    return {
      date,
      config,
      record: entries.find((r) => r.date === date) ?? null,
      expected: expectedHabitDate(config, date),
    };
  });
}
const summarize = (
  source: HabitDay[],
  today = "2026-11-02",
  archived = false,
) => summarizeHabitActivity("h", "Read", archived, source, today);
test("avoidance heatmaps distinguish zero, occurrence, missing, today and future", () => {
  const config = {
    ...cfg,
    kind: "quantity" as const,
    direction: "avoid" as const,
    unit: "drinks",
    target: 0,
  };
  const data = summarize(
    days(config, [
      record("2026-10-26", "done", 0),
      record("2026-10-27", "done", 1000),
    ]),
    "2026-10-29",
  );
  assert.deepEqual(
    data.days.map((d) => d.state),
    ["met", "exceeded", "missed", "unlogged", "future", "future", "future"],
  );
  assert.ok(Math.abs(data.rate! - 100 / 3) < 0.000001);
  assert.equal(data.logged, 2);
  assert.equal(data.met, 1);
  assert.equal(data.quantities[0].average, 0.5);
  assert.equal(data.quantities[0].days[0].value, 0);
  assert.equal(data.quantities[0].days[2].value, null);
  assert.equal(data.quantities[0].days[0].target, 0);
});
test("binary negative occurrence and explicit non-occurrence reuse goal direction", () => {
  const data = summarize(
    days({ ...cfg, direction: "avoid" }, [
      record("2026-10-26", "notDone"),
      record("2026-10-27", "done"),
    ]),
  );
  assert.equal(data.days[0].state, "met");
  assert.equal(data.days[1].state, "exceeded");
  assert.equal(data.met, 1);
});
test("awareness quantity entries have no inferred success, adherence or streak", () => {
  const data = summarize(
    days({ ...cfg, kind: "quantity", unit: "cups" }, [
      record("2026-10-26", "done", 0),
    ]),
  );
  assert.equal(data.days[0].state, "recorded");
  assert.equal(data.rate, null);
  assert.equal(data.met, 0);
  assert.equal(data.latestRun, null);
  assert.equal(data.quantities[0].total, 0);
});
test("weekday runs skip rest and unscheduled days but stop at missing expected days", () => {
  const config = {
    ...cfg,
    kind: "workout" as const,
    schedule: "weekdays" as const,
    weekdays: [1, 3, 5],
    rotation: ["Push", "Pull"],
  };
  const data = summarize(
    days(config, [
      record("2026-10-26"),
      record("2026-10-28", "rest"),
      record("2026-10-30", "done", null, "Legs"),
    ]),
  );
  assert.equal(data.rate, 100);
  assert.equal(data.eligible, 2);
  assert.equal(data.longestRun, 2);
  assert.equal(data.latestRun, 2);
  assert.equal(data.days[1].state, "unscheduled");
  assert.equal(data.days[2].state, "rest");
  assert.deepEqual(data.workouts, [
    { name: "Legs", count: 1 },
    { name: "Unspecified workout", count: 1 },
  ]);
  const missed = summarize(days(config, [record("2026-10-26")]));
  assert.equal(missed.latestRun, 0);
  assert.equal(missed.longestRun, 1);
});
test("unrecorded rotation rest decisions and archived gaps remain unknown", () => {
  const workout = summarize(
    days({ ...cfg, kind: "workout", rotation: ["Push", "Rest"] }, [
      record("2026-10-26", "rest"),
    ]),
  );
  assert.equal(workout.days[1].state, "unknown");
  assert.equal(workout.eligible, 0);
  assert.equal(workout.rate, null);
  const archived = summarize(
    days(cfg, [record("2026-10-26")]),
    "2026-11-02",
    true,
  );
  assert.equal(archived.days[1].state, "unknown");
  assert.equal(archived.eligible, 1);
  assert.equal(archived.rate, 100);
});
test("flexible weekly goals use only complete elapsed unchanged weeks, with no invented daily misses", () => {
  const config = { ...cfg, schedule: "weekly" as const, timesPerWeek: 2 };
  const source = days(config, [record("2026-10-26"), record("2026-10-29")]);
  const data = summarize(source);
  assert.equal(data.rate, null);
  assert.equal(data.latestRun, null);
  assert.equal(data.weeks[0].met, true);
  assert.equal(data.days[1].state, "unscheduled");
  assert.equal(summarize(source, "2026-10-30").weeks[0].eligible, false);
  assert.equal(summarize(source.slice(1)).weeks[0].eligible, false);
  source[3].config = { ...config, timesPerWeek: 4 };
  assert.equal(summarize(source).weeks[0].eligible, false);
});
test("historical quantity units and targets stay separate; corrections replace rather than add", () => {
  const source = days(
    { ...cfg, kind: "quantity", unit: "mL", goal: "atLeast", target: 500 },
    [record("2026-10-26", "done", 500000), record("2026-10-27", "done", 1000)],
  );
  source[1].config = {
    ...cfg,
    kind: "quantity",
    unit: "L",
    goal: "atLeast",
    target: 1,
  };
  const data = summarize(source);
  assert.equal(data.quantities.length, 2);
  assert.equal(data.quantities[0].total, 500);
  assert.equal(data.quantities[1].total, 1);
  source[0].record = record("2026-10-26", "done", 200000);
  assert.equal(summarize(source).quantities[0].total, 200);
  assert.equal(summarize(source).days[0].state, "below");
});
test("habit server projection uses saved revisions and local dates without changing records", () => {
  const s = openDatabase(":memory:"),
    now = Date.parse("2026-11-02T04:30:00Z");
  try {
    seed(s, Date.parse("2026-10-26T12:00:00Z"));
    s.db
      .insert(habits)
      .values({
        id: "h",
        createdDate: "2026-10-26",
        createdAt: 0,
        updatedAt: 0,
      })
      .run();
    s.db
      .insert(habitRevisions)
      .values([
        {
          id: "v1",
          habitId: "h",
          version: 1,
          effectiveDate: "2026-10-26",
          config: {
            ...cfg,
            kind: "quantity",
            direction: "limit",
            goal: "atMost",
            unit: "drinks",
            target: 2,
          },
        },
        {
          id: "v2",
          habitId: "h",
          version: 2,
          effectiveDate: "2026-10-28",
          config: {
            ...cfg,
            kind: "quantity",
            direction: "avoid",
            unit: "drinks",
            target: 0,
          },
        },
      ])
      .run();
    s.db
      .insert(habitRecords)
      .values(record("2026-10-26", "done", 1000))
      .run();
    const before = s.db.select().from(habitRecords).all();
    const data = getAnalytics(s, { from: "2026-10-25", to: "2026-11-03" }, now);
    assert.equal(data.today, "2026-11-01");
    assert.equal(data.habits[0].days[0].state, "unscheduled");
    assert.equal(data.habits[0].days[1].state, "met");
    assert.equal(data.habits[0].days.at(-1)!.state, "future");
    assert.deepEqual(s.db.select().from(habitRecords).all(), before);
    s.db
      .update(habitRecords)
      .set({ quantityMilli: 3000 })
      .where(eq(habitRecords.id, "2026-10-26"))
      .run();
    assert.equal(
      getAnalytics(s, { from: "2026-10-26", to: "2026-10-26" }, now).habits[0]
        .days[0].state,
      "exceeded",
    );
  } finally {
    s.sqlite.close();
  }
});
test("roadmap activity distinguishes actual study from completion and preserves DST duration, mastery and future days", () => {
  const s = openDatabase(":memory:"),
    now = Date.parse("2026-11-03T12:00:00Z");
  try {
    seed(s, Date.parse("2026-10-26T12:00:00Z"));
    s.db
      .insert(roadmaps)
      .values({
        id: "r",
        title: "OS",
        category: "Other",
        createdAt: 0,
        color: "blue",
        archived: true,
      })
      .run();
    s.db
      .insert(roadmapSections)
      .values({ id: "m", roadmapId: "r", title: "Memory", position: 0 })
      .run();
    s.db
      .insert(learningSteps)
      .values({
        id: "step",
        sectionId: "m",
        title: "Paging",
        position: 0,
        status: "completed",
        completed: true,
      })
      .run();
    for (const date of ["2026-10-31", "2026-11-01", "2026-11-04"]) {
      s.db
        .insert(tasks)
        .values({
          id: date,
          plannedDate: date,
          title: "OS",
          category: "Other",
          targetMinutes: 60,
          status: date === "2026-10-31" ? "done" : "pending",
          createdAt: 0,
          updatedAt: 0,
        })
        .run();
      s.db.insert(taskStudy).values({ taskId: date, roadmapId: "r" }).run();
    }
    s.db
      .insert(sessions)
      .values({
        id: "s",
        taskId: "2026-11-01",
        startedAt: Date.parse("2026-11-01T04:00:00Z"),
        endedAt: Date.parse("2026-11-02T05:00:00Z"),
        source: "manual",
      })
      .run();
    s.db
      .insert(sessionLearning)
      .values({ sessionId: "s", roadmapId: "r", sectionId: "m" })
      .run();
    s.db
      .insert(sessions)
      .values({
        id: "extra",
        taskId: "2026-11-01",
        startedAt: Date.parse("2026-11-02T15:00:00Z"),
        endedAt: Date.parse("2026-11-02T16:00:00Z"),
        source: "manual",
      })
      .run();
    s.db
      .insert(sessionLearning)
      .values({ sessionId: "extra", roadmapId: "r", sectionId: "m" })
      .run();
    const map = getAnalytics(s, { from: "2026-10-31", to: "2026-11-04" }, now)
      .roadmaps[0];
    assert.deepEqual(
      map.activity.map((d) => d.state),
      ["missed", "met", "recorded", "unscheduled", "future"],
    );
    assert.equal(map.consistency, 50);
    assert.equal(map.studyMs, 26 * 3600000);
    assert.equal(map.modules[0].studyMs, map.studyMs);
    assert.equal(map.lastStudied, "2026-11-02");
    assert.equal(map.eligibleDays, 2);
    assert.equal(map.dailyTime[1].studyMs, 25 * 3600000);
    assert.deepEqual(map.mastery, { completed: 1, steps: 1 });
    s.db.update(roadmapSections).set({ archived: true }).run();
    assert.equal(
      getAnalytics(s, { from: "2026-10-31", to: "2026-11-04" }, now).roadmaps[0]
        .mastery.steps,
      0,
    );
  } finally {
    s.sqlite.close();
  }
});

test("empty activity has no invented success or streak", () => {
  const empty = summarize([]);
  assert.equal(empty.rate, null);
  assert.equal(empty.latestRun, null);
  assert.deepEqual(empty.quantities, []);
  const noLogs = summarize(days());
  assert.equal(noLogs.rate, 0);
  assert.equal(noLogs.logged, 0);
  const voluntary = summarize(
    days({ ...cfg, schedule: "weekdays", weekdays: [3] }, [
      record("2026-10-26"),
    ]),
  );
  assert.equal(voluntary.successful, 0);
  assert.match(voluntary.days[0].detail, /Unscheduled entry/);
});
