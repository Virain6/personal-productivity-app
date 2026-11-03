import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { openDatabase } from "../src/server/db/connection";
import { seed } from "../src/server/services/scheduling";
import { mutate } from "../src/server/services/mutations";
import { getWeeklyReview } from "../src/server/services/weekly-reviews";
import {
  weeklyReviews,
  roadmaps,
  tasks,
  taskStudy,
  sessions,
  sessionLearning,
} from "../src/server/db/schema";
import {
  isReviewWeek,
  weeklyHighlights,
  reflectionDirty,
  reflectionText,
  recoverDraft,
  emptyReflection,
} from "../src/lib/weekly-review";
const now = Date.parse("2026-11-03T15:00:00Z");
const save = (week = "2026-11-02", version = 0, wins = "Finished SQL") => ({
  operationKey: randomUUID(),
  command: {
    action: "weeklyReviewSave",
    week,
    version,
    wins,
    challenges: "Time management",
    priorities: "Practice joins",
  },
});
function store() {
  const s = openDatabase(":memory:");
  seed(s, now);
  return s;
}
test("Monday weeks cross year and Toronto boundaries; navigation creates no reflection", () => {
  const s = store();
  try {
    const a = getWeeklyReview(s, undefined, Date.parse("2027-01-04T04:30:00Z"));
    assert.deepEqual(a.analytics.range, {
      from: "2026-12-28",
      to: "2027-01-03",
    });
    assert.equal(a.reflection, null);
    assert.deepEqual(a.history, []);
    assert.equal(s.db.select().from(weeklyReviews).all().length, 0);
    assert.throws(() => getWeeklyReview(s, "2026-11-03", now), /Monday/);
    assert.equal(isReviewWeek("not-date"), false);
  } finally {
    s.sqlite.close();
  }
});
test("create, retry, edit and historical retrieval keep one record per week with conflicts", () => {
  const s = store();
  try {
    const request = save();
    mutate(s, request, now);
    mutate(s, request, now);
    assert.equal(s.db.select().from(weeklyReviews).all().length, 1);
    assert.equal(getWeeklyReview(s, "2026-11-02", now).reflection?.version, 1);
    assert.throws(() => mutate(s, save(), now), /changed elsewhere/);
    mutate(s, save("2026-11-02", 1, "Corrected reflection"), now + 1);
    mutate(s, save("2026-10-26", 0, "Earlier week"), now + 2);
    const result = getWeeklyReview(s, "2026-11-02", now);
    assert.equal(result.reflection?.wins, "Corrected reflection");
    assert.equal(result.reflection?.version, 2);
    assert.deepEqual(
      result.history.map((h) => h.week),
      ["2026-11-02", "2026-10-26"],
    );
    assert.equal(
      getWeeklyReview(s, "2026-10-26", now).reflection?.wins,
      "Earlier week",
    );
  } finally {
    s.sqlite.close();
  }
});
test("reject empty new reviews, invalid weeks, oversized text and invalid versions", () => {
  const s = store();
  try {
    const r = save();
    r.command.wins = " ";
    r.command.challenges = "";
    r.command.priorities = "";
    assert.throws(() => mutate(s, r, now), /Add a reflection/);
    assert.throws(() => mutate(s, save("2026-11-03"), now));
    assert.throws(() => mutate(s, save("2026-11-02", -1), now));
    assert.throws(() =>
      mutate(s, save("2026-11-02", 0, "x".repeat(3001)), now),
    );
    assert.equal(s.db.select().from(weeklyReviews).all().length, 0);
  } finally {
    s.sqlite.close();
  }
});
test("weekly totals reuse saved sessions, archived roadmap attribution, prior period and future occurrence rules", () => {
  const s = store();
  try {
    s.db
      .insert(roadmaps)
      .values({
        id: "r",
        title: "Archived SQL",
        category: "Other",
        archived: true,
        createdAt: 0,
      })
      .run();
    for (const [id, date, status] of [
      ["old", "2026-10-26", "done"],
      ["current", "2026-11-02", "done"],
      ["future", "2026-11-05", "pending"],
    ] as const) {
      s.db
        .insert(tasks)
        .values({
          id,
          plannedDate: date,
          title: "Study",
          category: "Other",
          status,
          targetMinutes: 60,
          createdAt: 0,
          updatedAt: 0,
        })
        .run();
      s.db.insert(taskStudy).values({ taskId: id, roadmapId: "r" }).run();
    }
    for (const [id, taskId, start, end, source] of [
      ["one", "current", "2026-11-02T14:00Z", "2026-11-02T15:00Z", "timer"],
      ["two", "current", "2026-11-02T16:00Z", "2026-11-02T16:30Z", "manual"],
      ["prior", "old", "2026-10-26T14:00Z", "2026-10-26T14:30Z", "manual"],
    ] as const) {
      s.db
        .insert(sessions)
        .values({
          id,
          taskId,
          startedAt: Date.parse(start),
          endedAt: Date.parse(end),
          source,
        })
        .run();
      s.db
        .insert(sessionLearning)
        .values({ sessionId: id, roadmapId: "r" })
        .run();
    }
    const a = getWeeklyReview(s, "2026-11-02", now).analytics,
      h = weeklyHighlights(a);
    assert.equal(a.summary.studyMs, 90 * 60000);
    assert.equal(a.previous?.studyMs, 30 * 60000);
    assert.equal(a.previous?.to, "2026-10-27");
    assert.equal(a.roadmaps[0].archived, true);
    assert.equal(a.summary.studyTasks.upcoming, 1);
    assert.equal(a.summary.studyTasks.missed, 0);
    assert.equal(h.scheduled, 2);
    assert.equal(h.mostActive[0].date, "2026-11-02");
    assert.equal(h.habitRate, null);
  } finally {
    s.sqlite.close();
  }
});
test("empty weeks do not invent activity, habit success or prior comparisons", () => {
  const s = store();
  try {
    const a = getWeeklyReview(s, "2025-12-29", now).analytics,
      h = weeklyHighlights(a);
    assert.equal(a.summary.studyMs, 0);
    assert.equal(a.previous, null);
    assert.deepEqual(h.mostActive, []);
    assert.equal(h.habitRate, null);
  } finally {
    s.sqlite.close();
  }
});
test("unsaved drafts retain text and stale revision through navigation recovery", () => {
  const text = { ...emptyReflection, wins: "Unsent reflection" };
  assert.equal(reflectionDirty(text, emptyReflection), true);
  assert.equal(reflectionDirty(text, { ...text }), false);
  const raw = JSON.stringify({ week: "2026-11-02", text, version: 2 });
  assert.deepEqual(recoverDraft(raw, "2026-11-02"), { text, version: 2 });
  assert.equal(recoverDraft(raw, "2026-10-26"), null);
  assert.equal(recoverDraft("{", "2026-11-02"), null);
  assert.equal(
    recoverDraft(
      JSON.stringify({ week: "2026-11-02", text: { wins: 42 }, version: 2 }),
      "2026-11-02",
    ),
    null,
  );
});

test("editing a loaded reflection sends only text, preserving the new concurrency version", () => {
  const s = store();
  try {
    mutate(s, save(), now);
    const loaded = getWeeklyReview(s, "2026-11-02", now).reflection!;
    const text = reflectionText(loaded);
    assert.deepEqual(Object.keys(text).sort(), [
      "challenges",
      "priorities",
      "wins",
    ]);
    for (const version of [1, 2])
      mutate(
        s,
        {
          operationKey: randomUUID(),
          command: {
            action: "weeklyReviewSave",
            week: loaded.week,
            version,
            ...text,
            wins: `Edit ${version}`,
          },
        },
        now + version,
      );
    assert.equal(
      getWeeklyReview(s, loaded.week, now).reflection?.wins,
      "Edit 2",
    );
  } finally {
    s.sqlite.close();
  }
});
