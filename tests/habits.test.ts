import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
  copyFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { openDatabase, type Store } from "../src/server/db/connection";
import { seed } from "../src/server/services/scheduling";
import { mutate } from "../src/server/services/mutations";
import { getDashboard } from "../src/server/services/dashboard";
import { getHabits, getHabitCalendar } from "../src/server/services/habits";
import { habitRecords, settings, tasks } from "../src/server/db/schema";
import {
  homeHabits,
  habitResult,
  habitOutcome,
  habitDirection,
  summarizeHabitDays,
  type HabitConfig,
} from "../src/lib/habit-types";
import { eq } from "drizzle-orm";
const now = Date.parse("2026-10-26T16:00:00Z"),
  date = "2026-10-26";
const config: HabitConfig = {
  name: "Read",
  kind: "binary",
  unit: "",
  goal: "awareness",
  target: null,
  schedule: "daily",
  weekdays: [],
  timesPerWeek: 3,
  rotation: [],
};
function setup(path = ":memory:") {
  const s = openDatabase(path);
  seed(s, now);
  return s;
}
function command(s: Store, c: Record<string, unknown>, time = now) {
  return mutate(s, { operationKey: crypto.randomUUID(), command: c }, time);
}
function create(s: Store, fields: Partial<HabitConfig> = {}, time = now) {
  return command(
    s,
    { action: "habitCreate", config: { ...config, ...fields } },
    time,
  ).id!;
}
function view(s: Store, id: string, day = date, time = now) {
  return getHabits(s, day, time).habits.find((h) => h.id === id)!;
}
function record(
  s: Store,
  id: string,
  fields: Record<string, unknown> = {},
  day = date,
  time = now,
) {
  const h = view(s, id, day, time);
  return {
    action: "habitRecord",
    id,
    version: h.version,
    date: day,
    revisionId: h.revisionId,
    entryVersion: h.record?.version ?? 0,
    state: "done",
    quantity: null,
    workout: "",
    advance: false,
    ...fields,
  };
}
test("habit creation/edit preserves original type/unit/target in history", () => {
  const s = setup();
  try {
    const id = create(s, {
      kind: "quantity",
      unit: "mL",
      goal: "atLeast",
      target: 2000,
    });
    command(s, record(s, id, { quantity: 1250.25 }));
    command(s, {
      action: "habitEdit",
      id,
      version: view(s, id).version,
      config: {
        ...config,
        name: "Meditate",
        schedule: "weekdays",
        weekdays: [2, 4],
      },
    });
    assert.equal(view(s, id).config.kind, "binary");
    assert.equal(view(s, id).dateConfig?.kind, "quantity");
    assert.equal(view(s, id).record?.quantityMilli, 1250250);
    const tomorrow = view(s, id, "2026-10-27", now + 86400000);
    assert.equal(tomorrow.dateConfig?.name, "Meditate");
    assert.equal(tomorrow.expected, true);
    assert.equal(getHabits(s, date).history[0].config.unit, "mL");
  } finally {
    s.sqlite.close();
  }
});
test("binary complete/undo/correct, retry and duplicate daily prevention", () => {
  const s = setup();
  try {
    const id = create(s);
    const c = record(s, id);
    const request = { operationKey: crypto.randomUUID(), command: c };
    mutate(s, request, now);
    mutate(s, request, now);
    assert.equal(view(s, id).record?.state, "done");
    assert.equal(s.db.select().from(habitRecords).all().length, 1);
    assert.throws(() => command(s, c), /changed/);
    command(s, record(s, id, { state: "notDone" }));
    assert.equal(view(s, id).record?.state, "notDone");
    command(s, record(s, id));
    command(s, record(s, id, { state: "unlogged" }));
    assert.equal(s.db.select().from(habitRecords).all().length, 1);
    const row = s.db.select().from(habitRecords).get()!;
    assert.throws(
      () =>
        s.db
          .insert(habitRecords)
          .values({ ...row, id: crypto.randomUUID() })
          .run(),
      /UNIQUE/,
    );
  } finally {
    s.sqlite.close();
  }
});
test("quantity corrections replace daily total, zero is explicit, limits support reduction and awareness", () => {
  const s = setup();
  try {
    const id = create(s, {
      kind: "quantity",
      unit: "drinks",
      goal: "atMost",
      target: 2,
    });
    command(s, record(s, id, { quantity: 3 }));
    assert.match(
      habitResult(view(s, id).dateConfig!, view(s, id).record),
      /Exceeded limit/,
    );
    command(s, record(s, id, { quantity: 1.5 }));
    assert.equal(view(s, id).record?.quantityMilli, 1500);
    assert.match(
      habitResult(view(s, id).dateConfig!, view(s, id).record),
      /Within limit/,
    );
    for (const quantity of [-1, 0.00001, Infinity, NaN])
      assert.throws(() => command(s, record(s, id, { quantity })));
    command(s, record(s, id, { quantity: 0 }));
    assert.equal(view(s, id).record?.quantityMilli, 0);
    command(s, record(s, id, { state: "unlogged" }));
    assert.match(
      habitResult(view(s, id).dateConfig!, view(s, id).record),
      /Not logged/,
    );
    const aware = create(s, { kind: "quantity", unit: "pages" });
    command(s, record(s, aware, { quantity: 4 }));
    assert.equal(
      habitResult(view(s, aware).dateConfig!, view(s, aware).record),
      "4 pages recorded",
    );
  } finally {
    s.sqlite.close();
  }
});
test("workout actual differs from plan; missed/rest never advance; explicit advance and latest undo are safe", () => {
  const s = setup();
  try {
    const id = create(s, {
      kind: "workout",
      rotation: ["Push", "Pull", "Legs", "Rest"],
    });
    assert.equal(view(s, id, "2026-10-29", now + 3 * 86400000).nextIndex, 0);
    command(s, record(s, id, { workout: "Cardio" }));
    assert.equal(view(s, id).record?.workout, "Cardio");
    assert.equal(view(s, id).record?.plannedWorkout, "Push");
    assert.equal(view(s, id).nextIndex, 0);
    command(s, record(s, id, { state: "unlogged" }));
    const request = {
      operationKey: crypto.randomUUID(),
      command: record(s, id, { workout: "Push", advance: true }),
    };
    mutate(s, request, now);
    mutate(s, request, now);
    assert.equal(view(s, id).nextIndex, 1);
    command(s, record(s, id, { state: "notDone" }));
    assert.equal(view(s, id).nextIndex, 0);
    command(s, record(s, id, { state: "rest" }));
    assert.equal(view(s, id).nextIndex, 0);
    assert.match(
      habitResult(view(s, id).dateConfig!, view(s, id).record),
      /not a missed/,
    );
    command(s, {
      action: "habitNext",
      id,
      version: view(s, id).version,
      nextIndex: 2,
      nextDate: "2026-10-28",
    });
    assert.equal(view(s, id).nextDate, "2026-10-28");
    assert.equal(view(s, id).nextIndex, 2);
    assert.throws(
      () => command(s, record(s, id, { workout: "Legs", advance: true })),
      /later day/,
    );
  } finally {
    s.sqlite.close();
  }
});
test("archive/restore retains records and supports old entry corrections", () => {
  const s = setup();
  try {
    const id = create(s);
    command(s, record(s, id));
    command(s, {
      action: "habitArchive",
      id,
      version: view(s, id).version,
      archived: true,
    });
    assert.equal(view(s, id).archived, true);
    command(s, record(s, id, { state: "notDone" }));
    assert.throws(
      () =>
        command(
          s,
          record(s, id, {}, "2026-10-27", now + 86400000),
          now + 86400000,
        ),
      /Restore/,
    );
    command(s, {
      action: "habitArchive",
      id,
      version: view(s, id).version,
      archived: false,
    });
    assert.equal(view(s, id).record?.state, "notDone");
    assert.equal(view(s, id).archived, false);
  } finally {
    s.sqlite.close();
  }
});
test("local dates, future rejection, selected weekdays and weekly flexible count", () => {
  const s = setup();
  try {
    const id = create(s, { schedule: "weekdays", weekdays: [2, 4] });
    assert.equal(view(s, id).expected, false);
    assert.throws(
      () =>
        command(
          s,
          record(s, id, { revisionId: view(s, id).revisionId }, "2026-10-25"),
        ),
      /creation/,
    );
    assert.throws(() => command(s, record(s, id, {}, "2026-10-27")), /today/);
    assert.throws(() => getHabits(s, "2026-02-30"), /valid/);
    const weekly = create(s, { schedule: "weekly", timesPerWeek: 3 });
    command(s, record(s, weekly));
    assert.equal(view(s, weekly).weekLogged, 1);
    assert.equal(view(s, weekly).expected, false);
    // 00:30 UTC is still October 26 in Toronto.
    const utcNext = Date.parse("2026-10-27T00:30:00Z");
    assert.equal(getHabits(s, date, utcNext).today, date);
    s.db
      .update(settings)
      .set({ timezone: "Asia/Tokyo" })
      .where(eq(settings.id, 1))
      .run();
    assert.equal(getHabits(s, "2026-10-27", utcNext).today, "2026-10-27");
  } finally {
    s.sqlite.close();
  }
});
test("habit data persists across reconnect and repeat migrations", () => {
  const dir = mkdtempSync(join(tmpdir(), "habit-persist-"));
  const path = join(dir, "test.db");
  let s = setup(path);
  try {
    const id = create(s);
    command(s, record(s, id));
    s.sqlite.close();
    s = openDatabase(path);
    assert.equal(view(s, id).record?.state, "done");
    assert.deepEqual(s.sqlite.pragma("foreign_key_check"), []);
  } finally {
    s.sqlite.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("additive Habits migration preserves existing Home tasks and timer records", () => {
  const dir = mkdtempSync(join(tmpdir(), "habit-upgrade-"));
  const oldFolder = join(dir, "old");
  mkdirSync(join(oldFolder, "meta"), { recursive: true });
  const journal = JSON.parse(
    readFileSync("drizzle/meta/_journal.json", "utf8"),
  );
  journal.entries = journal.entries.slice(0, 2);
  writeFileSync(join(oldFolder, "meta/_journal.json"), JSON.stringify(journal));
  for (const entry of journal.entries)
    copyFileSync(
      `drizzle/${entry.tag}.sql`,
      join(oldFolder, `${entry.tag}.sql`),
    );
  const path = join(dir, "upgrade.db");
  const sqlite = new Database(path);
  migrate(drizzle(sqlite), { migrationsFolder: oldFolder });
  sqlite
    .prepare("INSERT INTO settings VALUES(1,'America/Toronto','2026-10-26')")
    .run();
  sqlite
    .prepare(
      "INSERT INTO tasks(id,planned_date,title,category,target_minutes,created_at,updated_at) VALUES('preserve','2026-10-26','Existing task','DSA',60,1,1)",
    )
    .run();
  sqlite
    .prepare(
      "INSERT INTO time_sessions(id,task_id,started_at,source) VALUES('running','preserve',1,'timer')",
    )
    .run();
  sqlite.close();
  const s = openDatabase(path);
  try {
    assert.equal(s.db.select().from(tasks).get()?.title, "Existing task");
    assert.equal(
      (
        s.sqlite
          .prepare("SELECT ended_at FROM time_sessions WHERE id='running'")
          .get() as { ended_at: null }
      ).ended_at,
      null,
    );
    assert.deepEqual(s.sqlite.pragma("foreign_key_check"), []);
    assert.equal(s.sqlite.pragma("integrity_check", { simple: true }), "ok");
  } finally {
    s.sqlite.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("past-date correction retains its original unit and target after settings change", () => {
  const s = setup();
  try {
    const id = create(s, {
      kind: "quantity",
      unit: "mL",
      goal: "atLeast",
      target: 2000,
    });
    command(s, record(s, id, { quantity: 1000 }));
    const tomorrow = now + 86400000;
    command(
      s,
      {
        action: "habitEdit",
        id,
        version: view(s, id).version,
        config: {
          ...config,
          name: "Water",
          kind: "quantity",
          unit: "L",
          goal: "atLeast",
          target: 2.5,
        },
      },
      tomorrow,
    );
    command(s, record(s, id, { quantity: 1500 }, date, tomorrow), tomorrow);
    const oldDay = view(s, id, date, tomorrow);
    assert.equal(oldDay.record?.quantityMilli, 1500000);
    assert.equal(oldDay.dateConfig?.unit, "mL");
    assert.equal(oldDay.dateConfig?.target, 2000);
    assert.equal(view(s, id, "2026-10-27", tomorrow).dateConfig?.unit, "L");
    assert.equal(s.db.select().from(habitRecords).all().length, 1);
  } finally {
    s.sqlite.close();
  }
});
test("older workout undo rejects safely after a manual plan change", () => {
  const s = setup();
  try {
    const id = create(s, {
      kind: "workout",
      rotation: ["Push", "Pull", "Rest"],
    });
    command(s, record(s, id, { workout: "Push", advance: true }));
    command(s, {
      action: "habitNext",
      id,
      version: view(s, id).version,
      nextIndex: 2,
      nextDate: null,
    });
    assert.throws(
      () => command(s, record(s, id, { state: "notDone" })),
      /older rotation advance/,
    );
    assert.equal(view(s, id).record?.state, "done");
    assert.equal(view(s, id).nextIndex, 2);
    command(s, record(s, id, { workout: "Cardio" }));
    assert.equal(view(s, id).record?.workout, "Cardio");
    assert.equal(view(s, id).nextIndex, 2);
  } finally {
    s.sqlite.close();
  }
});

test("legacy stored revisions keep measurement, target and outcomes without rewriting JSON", () => {
  const s = setup();
  try {
    for (const fields of [
      {},
      { kind: "quantity", unit: "mL", goal: "atLeast", target: 2 },
      { kind: "quantity", unit: "drinks", goal: "atMost", target: 0 },
      { kind: "quantity", unit: "pages", goal: "awareness", target: null },
      { kind: "workout", rotation: ["Push", "Rest"] },
    ] as Partial<HabitConfig>[]) {
      const id = create(s, fields);
      // Reproduce Phase 2 on-disk JSON, not a new-version create default.
      const legacy = JSON.stringify({ ...config, ...fields });
      s.sqlite
        .prepare("UPDATE habit_revisions SET config=? WHERE habit_id=?")
        .run(legacy, id);
      const h = view(s, id);
      assert.equal(
        habitDirection(h.config),
        fields.goal === "atMost" ? "limit" : "build",
      );
      command(
        s,
        record(s, id, {
          quantity: fields.kind === "quantity" ? 0 : null,
          workout: fields.kind === "workout" ? "Push" : "",
        }),
      );
      const saved = view(s, id);
      assert.equal(
        habitOutcome(saved.dateConfig!, saved.record),
        fields.goal === "atLeast"
          ? "below"
          : fields.kind === "quantity" && fields.goal === "awareness"
            ? "recorded"
            : "met",
      );
      assert.deepEqual(saved.dateConfig, { ...config, ...fields });
      assert.equal(
        (
          s.sqlite
            .prepare("SELECT config FROM habit_revisions WHERE habit_id=?")
            .get(id) as { config: string }
        ).config,
        legacy,
      );
    }
  } finally {
    s.sqlite.close();
  }
});
test("build, limit and avoid evaluate quantities and binary observations; missing is never zero", () => {
  const s = setup();
  try {
    for (const direction of ["build", "limit", "avoid"] as const) {
      for (const kind of ["binary", "quantity", "workout"] as const) {
        const id = create(s, {
          kind,
          direction,
          target: direction === "build" ? (kind === "quantity" ? 1 : null) : 0,
          goal: direction === "build" ? "atLeast" : "atMost",
          unit: "drinks",
          rotation: ["Push", "Rest"],
        });
        assert.equal(habitOutcome(view(s, id).config, null), "unlogged");
        command(
          s,
          record(s, id, {
            state: kind === "quantity" ? "done" : "notDone",
            quantity: kind === "quantity" ? 0 : null,
          }),
        );
        assert.equal(
          habitOutcome(view(s, id).dateConfig!, view(s, id).record),
          direction === "build" ? "below" : "met",
        );
        command(
          s,
          record(s, id, {
            quantity: kind === "quantity" ? 1 : null,
            workout: kind === "workout" ? "Cardio" : "",
          }),
        );
        assert.equal(
          habitOutcome(view(s, id).dateConfig!, view(s, id).record),
          direction === "build" ? "met" : "exceeded",
        );
        if (kind === "workout") {
          command(s, record(s, id, { state: "rest" }));
          assert.equal(
            habitOutcome(view(s, id).dateConfig!, view(s, id).record),
            "rest",
          );
          assert.equal(view(s, id).nextIndex, 0);
        }
        command(s, record(s, id, { state: "unlogged" }));
        assert.equal(
          habitOutcome(view(s, id).dateConfig!, view(s, id).record),
          "unlogged",
        );
      }
    }
  } finally {
    s.sqlite.close();
  }
});
test("goal direction validation accepts zero limits and rejects ambiguous thresholds", () => {
  const s = setup();
  try {
    assert.throws(
      () => create(s, { direction: "limit", target: null }),
      /limit/,
    );
    assert.throws(() => create(s, { direction: "limit", target: 2 }), /0 or 1/);
    assert.throws(() => create(s, { direction: "avoid", target: 1 }), /zero/);
    const id = create(s, {
      kind: "quantity",
      unit: "drinks",
      direction: "avoid",
      target: null,
    });
    assert.equal(view(s, id).config.target, 0);
    assert.equal(view(s, id).config.goal, "atMost");
    const limit = create(s, {
      kind: "quantity",
      unit: "hours",
      direction: "limit",
      target: 1.5,
    });
    command(s, record(s, limit, { quantity: 1.5 }));
    assert.match(
      habitResult(view(s, limit).config, view(s, limit).record),
      /Within limit/,
    );
    command(s, record(s, limit, { quantity: 1.501 }));
    assert.match(
      habitResult(view(s, limit).config, view(s, limit).record),
      /Exceeded limit/,
    );
  } finally {
    s.sqlite.close();
  }
});
test("historical corrections retain original direction and update daily and weekly counts", () => {
  const s = setup();
  try {
    const id = create(s, {
      kind: "quantity",
      unit: "drinks",
      direction: "avoid",
      target: 0,
      schedule: "weekly",
    });
    command(s, record(s, id, { quantity: 1 }));
    const tomorrow = now + 86400000;
    command(
      s,
      {
        action: "habitEdit",
        id,
        version: view(s, id).version,
        config: {
          ...config,
          kind: "quantity",
          unit: "drinks",
          direction: "limit",
          target: 2,
        },
      },
      tomorrow,
    );
    command(s, record(s, id, { quantity: 0 }, date, tomorrow), tomorrow);
    command(
      s,
      record(s, id, { quantity: 2 }, "2026-10-27", tomorrow),
      tomorrow,
    );
    const h = view(s, id, date, tomorrow);
    assert.equal(h.dateConfig?.direction, "avoid");
    assert.equal(h.config.direction, "limit");
    assert.equal(h.record?.quantityMilli, 0);
    assert.equal(h.weekSummary.loggedDays, 2);
    assert.equal(h.weekSummary.goalDays, 2);
    const daily = summarizeHabitDays(
      [{ date, config: h.dateConfig, record: h.record, expected: true }],
      "2026-10-27",
    );
    assert.equal(daily.goalDays, 1);
    command(s, record(s, id, { quantity: 0.5 }, date, tomorrow), tomorrow);
    assert.equal(view(s, id, date, tomorrow).weekSummary.goalDays, 1);
    assert.equal(view(s, id, date, tomorrow).weekSummary.exceededDays, 1);
    assert.equal(s.db.select().from(habitRecords).all().length, 2);
  } finally {
    s.sqlite.close();
  }
});
test("weekly counts respect creation, weekdays, future dates, rest and local week boundaries", () => {
  const s = setup();
  try {
    const id = create(s, {
      direction: "avoid",
      target: 0,
      schedule: "weekdays",
      weekdays: [1, 3],
    });
    assert.deepEqual(view(s, id).weekSummary, {
      loggedDays: 0,
      goalDays: 0,
      restDays: 0,
      exceededDays: 0,
      unloggedDays: 1,
    });
    command(s, record(s, id, { state: "notDone" }));
    const utcTuesday = Date.parse("2026-10-27T00:30:00Z");
    assert.equal(view(s, id, date, utcTuesday).weekSummary.goalDays, 1);
    assert.equal(
      view(s, id, "2026-10-28", utcTuesday).weekSummary.unloggedDays,
      0,
    );
    const nextWeek = Date.parse("2026-11-02T05:30:00Z"); // Monday after Toronto DST fallback.
    assert.equal(getHabits(s, "2026-11-02", nextWeek).today, "2026-11-02");
    assert.equal(view(s, id, "2026-11-02", nextWeek).weekSummary.goalDays, 0);
    assert.equal(
      view(s, id, "2026-11-02", nextWeek).weekSummary.unloggedDays,
      1,
    );
    const workout = create(s, { kind: "workout", rotation: ["Rest", "Push"] });
    command(s, record(s, workout, { state: "rest" }));
    assert.deepEqual(view(s, workout).weekSummary, {
      loggedDays: 0,
      goalDays: 0,
      restDays: 1,
      exceededDays: 0,
      unloggedDays: 0,
    });
    const flexible = create(s, {
      direction: "avoid",
      target: 0,
      schedule: "weekly",
    });
    command(s, record(s, flexible, { state: "notDone" }));
    assert.equal(view(s, flexible).weekLogged, 1);
    assert.equal(view(s, flexible).weekSummary.goalDays, 1);
  } finally {
    s.sqlite.close();
  }
});

test("Home includes selected-date scheduled, flexible and voluntary records but excludes archives", () => {
  const s = setup();
  try {
    const daily = create(s);
    const tuesday = create(s, { schedule: "weekdays", weekdays: [2] });
    const weekly = create(s, { schedule: "weekly" });
    const archived = create(s);
    command(s, {
      action: "habitArchive",
      id: archived,
      version: 1,
      archived: true,
    });
    assert.deepEqual(
      homeHabits(getHabits(s, date, now))
        .map((h) => h.id)
        .sort(),
      [daily, weekly].sort(),
    );
    command(s, record(s, tuesday, { state: "notDone" }));
    assert.equal(
      homeHabits(getHabits(s, date, now)).some((h) => h.id === tuesday),
      true,
    );
    command(s, record(s, tuesday, { state: "unlogged" }));
    assert.equal(
      homeHabits(getHabits(s, date, now)).some((h) => h.id === tuesday),
      false,
    );
    assert.equal(
      homeHabits(getHabits(s, "2026-10-27", now + 86400000)).some(
        (h) => h.id === tuesday,
      ),
      true,
    );
    assert.equal(homeHabits(getHabits(s, "2026-10-25", now)).length, 0);
    const workout = create(s, {
      kind: "workout",
      schedule: "weekdays",
      weekdays: [2],
      rotation: ["Push"],
    });
    command(s, {
      action: "habitNext",
      id: workout,
      version: 1,
      nextIndex: 0,
      nextDate: date,
    });
    assert.equal(
      homeHabits(getHabits(s, date, now)).some((h) => h.id === workout),
      true,
    );
  } finally {
    s.sqlite.close();
  }
});
test("shared Home habit commands persist and cannot change task metrics or running timers", () => {
  const dir = mkdtempSync(join(tmpdir(), "habit-home-"));
  const path = join(dir, "test.db");
  let s = setup(path);
  try {
    const task = getDashboard(s, date, "2026-11-01", now).tasks[0];
    command(s, { action: "start", id: task.id });
    const before = getDashboard(s, date, "2026-11-01", now);
    const id = create(s, {
      kind: "quantity",
      unit: "drinks",
      direction: "limit",
      target: 0,
    });
    command(s, record(s, id, { quantity: 0 }));
    const saved = homeHabits(getHabits(s, date, now)).find((h) => h.id === id)!;
    assert.equal(habitOutcome(saved.dateConfig!, saved.record), "met");
    assert.deepEqual(getDashboard(s, date, "2026-11-01", now), before);
    s.sqlite.close();
    s = openDatabase(path);
    assert.equal(
      homeHabits(getHabits(s, date, now)).find((h) => h.id === id)?.record
        ?.quantityMilli,
      0,
    );
    assert.deepEqual(getDashboard(s, date, "2026-11-01", now), before);
  } finally {
    s.sqlite.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("habit calendar derives one item per relevant date, preserves history, and never writes task copies", () => {
  const s = setup();
  try {
    const id = create(s, { schedule: "weekdays", weekdays: [1, 3] });
    const before = s.sqlite.prepare("SELECT count(*) AS n FROM tasks").get();
    const calendar = getHabitCalendar(s, date, "2026-11-01", now);
    assert.equal(calendar.days.length, 7);
    assert.deepEqual(
      calendar.days
        .filter((d) => d.habits.some((h) => h.id === id))
        .map((d) => d.date),
      [date, "2026-10-28"],
    );
    assert.equal(
      getHabitCalendar(s, "2026-10-25", date, now).days[0].habits.length,
      0,
    );
    assert.deepEqual(
      s.sqlite.prepare("SELECT count(*) AS n FROM tasks").get(),
      before,
    );
    assert.equal(s.db.select().from(habitRecords).all().length, 0);
    command(s, record(s, id));
    const tomorrow = now + 86400000;
    command(
      s,
      {
        action: "habitEdit",
        id,
        version: view(s, id).version,
        config: {
          ...config,
          name: "Renamed",
          schedule: "weekdays",
          weekdays: [2, 4],
        },
      },
      tomorrow,
    );
    const updated = getHabitCalendar(s, date, "2026-11-01", tomorrow);
    assert.deepEqual(
      updated.days
        .filter((d) => d.habits.some((h) => h.id === id))
        .map((d) => d.date),
      [date, "2026-10-27", "2026-10-29"],
    );
    assert.equal(updated.days[0].habits[0].dateConfig?.name, "Read");
    command(
      s,
      {
        action: "habitArchive",
        id,
        version: view(s, id).version,
        archived: true,
      },
      tomorrow,
    );
    const archived = getHabitCalendar(s, date, "2026-11-01", tomorrow);
    assert.deepEqual(
      archived.days.filter((d) => d.habits.length).map((d) => d.date),
      [date],
    );
    assert.equal(archived.days[0].habits[0].archived, true);
    command(s, record(s, id, { state: "notDone" }, date, tomorrow), tomorrow);
    assert.equal(
      getHabitCalendar(s, date, date, tomorrow).days[0].habits[0].record?.state,
      "notDone",
    );
    assert.throws(() => getHabitCalendar(s, date, "2026-11-02", now), /seven/);
    assert.throws(() => getHabitCalendar(s, "2026-02-30", date, now), /seven/);
    assert.throws(() => getHabitCalendar(s, date, "2026-10-25", now), /seven/);
  } finally {
    s.sqlite.close();
  }
});
test("calendar workout move overrides future schedule without advancing or erasing recorded days", () => {
  const s = setup();
  try {
    const id = create(s, {
      kind: "workout",
      rotation: ["Push", "Pull", "Rest"],
    });
    command(s, {
      action: "habitNext",
      id,
      version: 1,
      nextIndex: 0,
      nextDate: "2026-10-28",
    });
    let calendar = getHabitCalendar(s, date, "2026-11-01", now);
    assert.deepEqual(
      calendar.days.filter((d) => d.habits.length).map((d) => d.date),
      ["2026-10-28"],
    );
    // A real voluntary entry is history, even if the next workout is planned later.
    command(s, record(s, id, { state: "rest" }));
    calendar = getHabitCalendar(s, date, "2026-11-01", now);
    assert.deepEqual(
      calendar.days.filter((d) => d.habits.length).map((d) => d.date),
      [date, "2026-10-28"],
    );
    assert.equal(calendar.days[0].habits[0].nextIndex, 0);
    assert.equal(calendar.days[0].habits[0].record?.state, "rest");
    const future = getHabitCalendar(s, "2026-11-02", "2026-11-08", now);
    assert.equal(future.days.flatMap((d) => d.habits).length, 0);
    assert.equal(view(s, id).nextIndex, 0);
  } finally {
    s.sqlite.close();
  }
});
