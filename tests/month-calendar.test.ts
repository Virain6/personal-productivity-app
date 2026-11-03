import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  monthGrid,
  calendarRange,
  moveCalendar,
  monthTaskColor,
  monthTaskStatus,
} from "../src/lib/month-calendar";
import { addDays, weekStart } from "../src/lib/dates";
import { openDatabase, type Store } from "../src/server/db/connection";
import { seed } from "../src/server/services/scheduling";
import { getDashboard } from "../src/server/services/dashboard";
import { getHabitCalendar, getHabits } from "../src/server/services/habits";
import { mutate } from "../src/server/services/mutations";
import { tasks } from "../src/server/db/schema";
import { habitOutcome } from "../src/lib/habit-types";
const now = Date.parse("2026-10-26T16:00:00Z");
const send = (s: Store, c: unknown) =>
  mutate(s, { operationKey: randomUUID(), command: c }, now).id!;
function setup() {
  const s = openDatabase(":memory:");
  seed(s, now);
  return s;
}
test("month grids are Monday-first complete weeks across leap and year boundaries", () => {
  for (const date of [
    "2026-11-03",
    "2026-02-15",
    "2027-02-15",
    "2024-02-29",
    "2027-01-01",
    "2026-12-31",
  ]) {
    const g = monthGrid(date);
    assert.equal(weekStart(g.from), g.from);
    assert.equal(g.days.length % 7, 0);
    assert.ok(g.days.length >= 28 && g.days.length <= 42);
    assert.ok(g.days.includes(date));
    assert.equal(g.days.at(-1), g.to);
    assert.equal(new Set(g.days).size, g.days.length);
    for (let i = 1; i < g.days.length; i++)
      assert.equal(g.days[i], addDays(g.days[i - 1], 1));
  }
  assert.equal(monthGrid("2027-02-15").days.length, 28);
  assert.equal(monthGrid("2026-11-03").from, "2026-10-26");
  assert.equal(monthGrid("2026-11-03").to, "2026-12-06");
  assert.equal(monthGrid("2024-02-15").days.includes("2024-02-29"), true);
});
test("month navigation clamps month ends while view switching keeps the selected date", () => {
  assert.equal(moveCalendar("2026-01-31", "month", 1), "2026-02-28");
  assert.equal(moveCalendar("2026-12-15", "month", 1), "2027-01-15");
  assert.equal(moveCalendar("2026-11-01", "day", 1), "2026-11-02");
  assert.equal(moveCalendar("2026-11-01", "week", 1), "2026-11-08");
  const selected = "2026-11-25";
  assert.deepEqual(
    calendarRange(selected, "day"),
    calendarRange(selected, "week"),
  );
  assert.equal(calendarRange(selected, "day").from, "2026-11-23");
  assert.equal(calendarRange(selected, "month").from, "2026-10-26");
});
test("month reads reuse roadmap recurrence and preserve moved, completed, skipped and one-off identities", () => {
  const s = setup();
  try {
    const id = send(s, {
      action: "roadmapCreate",
      title: "SQL",
      color: "blue",
      schedule: {
        weekdays: [1, 3],
        time: null,
        minutes: 60,
        paused: false,
        removed: false,
      },
    });
    const g = monthGrid("2026-11-03");
    const first = getDashboard(s, g.from, g.to, now).tasks.filter(
      (t) => t.studyRoadmap?.id === id,
    );
    assert.equal(first.length, 12);
    const completed = first[0],
      skipped = first[1],
      moved = first[2];
    send(s, {
      action: "status",
      id: completed.id,
      version: completed.version,
      status: "done",
    });
    send(s, {
      action: "status",
      id: skipped.id,
      version: skipped.version,
      status: "skipped",
    });
    s.db
      .update(tasks)
      .set({ plannedDate: "2026-11-07", version: moved.version + 1 })
      .where(eq(tasks.id, moved.id))
      .run();
    const extra = send(s, {
      action: "studyTask",
      roadmapId: id,
      stepId: null,
      date: "2026-11-07",
      time: null,
      additional: true,
    });
    const next = getDashboard(s, g.from, g.to, now).tasks.filter(
      (t) => t.studyRoadmap?.id === id,
    );
    assert.equal(next.length, 13);
    assert.equal(new Set(next.map((t) => t.id)).size, 13);
    assert.equal(
      next.find((t) => t.id === moved.id)?.plannedDate,
      "2026-11-07",
    );
    assert.ok(next.some((t) => t.id === extra));
    assert.equal(
      monthTaskStatus(
        next.find((t) => t.id === completed.id)!,
        "2026-11-10",
      ),
      "Completed",
    );
    assert.equal(
      monthTaskStatus(
        next.find((t) => t.id === skipped.id)!,
        "2026-11-10",
      ),
      "Skipped",
    );
    assert.equal(
      monthTaskStatus(
        next.find((t) => t.id === extra)!,
        "2026-11-03",
      ),
      "Scheduled",
    );
    assert.equal(
      monthTaskStatus(
        next.find((t) => t.id === extra)!,
        "2026-11-10",
      ),
      "Unfinished past",
    );
    assert.equal(monthTaskColor(next[0]), "#86B8DC");
    assert.equal(
      getDashboard(s, "2026-11-07", "2026-11-07", now).tasks.filter(
        (t) => t.studyRoadmap?.id === id,
      ).length,
      2,
    );
  } finally {
    s.sqlite.close();
  }
});
test("month habit projection matches daily rules, including zero, archived history and future days", () => {
  const s = setup();
  try {
    const id = send(s, {
      action: "habitCreate",
      config: {
        name: "Avoid",
        kind: "quantity",
        direction: "avoid",
        unit: "drinks",
        goal: "atMost",
        target: 0,
        schedule: "daily",
        weekdays: [],
        timesPerWeek: 3,
        rotation: [],
      },
    });
    const h = getHabits(s, "2026-10-26", now).habits.find((h) => h.id === id)!;
    send(s, {
      action: "habitRecord",
      id,
      date: "2026-10-26",
      revisionId: h.revisionId,
      entryVersion: 0,
      version: h.version,
      state: "done",
      quantity: 0,
      workout: "",
      advance: false,
    });
    const g = monthGrid("2026-11-03"),
      result = getHabitCalendar(s, g.from, g.to, now);
    assert.equal(result.days.length, 42);
    assert.equal(
      habitOutcome(
        result.days[0].habits[0].dateConfig!,
        result.days[0].habits[0].record,
      ),
      "met",
    );
    const future = result.days.find((d) => d.date === "2026-11-03")!;
    assert.equal(future.habits[0].record, null);
    assert.deepEqual(
      future.habits,
      getHabitCalendar(s, "2026-11-03", "2026-11-03", now).days[0].habits,
    );
    send(s, {
      action: "habitArchive",
      id,
      version: getHabits(s, "2026-10-26", now).habits.find((h) => h.id === id)!
        .version,
      archived: true,
    });
    const archived = getHabitCalendar(s, g.from, g.to, now);
    assert.equal(archived.days[0].habits[0].record?.quantityMilli, 0);
    assert.equal(archived.days[1].habits.length, 0);
    assert.throws(
      () => getHabitCalendar(s, g.from, addDays(g.from, 42), now),
      /42/,
    );
  } finally {
    s.sqlite.close();
  }
});
