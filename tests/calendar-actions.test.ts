import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { openDatabase, type Store } from "../src/server/db/connection";
import { seed, ensureOccurrences } from "../src/server/services/scheduling";
import { mutate } from "../src/server/services/mutations";
import { getDashboard } from "../src/server/services/dashboard";
import { getGeneralSchedule } from "../src/server/services/general-schedules";
import { getLearning } from "../src/server/services/learning";
import { tasks, sessions, completions } from "../src/server/db/schema";
const early = Date.parse("2026-10-26T16:00:00Z"),
  now = Date.parse("2026-11-04T16:00:00Z");
function setup() {
  const s = openDatabase(":memory:");
  seed(s, early);
  return s;
}
function send(s: Store, command: unknown, at = now, key = randomUUID()) {
  return mutate(s, { command, operationKey: key }, at).id!;
}
const fields = {
  title: "Personal task",
  category: "Other",
  plannedDate: "2026-11-04",
  mode: "flexible",
  suggestedTime: null,
  targetMinutes: 30,
  fixedStart: null,
  fixedEnd: null,
  optional: false,
  summary: "Description",
};
const config = {
  title: "Weekly planning",
  summary: "Plan the week",
  weekday: 1,
  time: "09:00",
  minutes: 30,
  optional: false,
};
function recurring(s: Store) {
  return send(
    s,
    {
      action: "generalScheduleSave",
      version: 0,
      effectiveFrom: "2026-10-26",
      config,
    },
    early,
  );
}
function task(s: Store, id: string) {
  return s.db.select().from(tasks).where(eq(tasks.id, id)).get()!;
}
test("one-off creation is retry-safe, validates inputs and retains selected date", () => {
  const s = setup();
  try {
    const key = randomUUID(),
      c = { action: "create", fields };
    const id = send(s, c, now, key);
    assert.equal(send(s, c, now, key), id);
    assert.equal(task(s, id).plannedDate, "2026-11-04");
    assert.equal(task(s, id).summary, "Description");
    assert.equal(s.db.select().from(tasks).all().length, 1);
    assert.throws(() =>
      send(s, { action: "create", fields: { ...fields, title: "" } }),
    );
    assert.throws(() =>
      send(s, { action: "create", fields: { ...fields, targetMinutes: -1 } }),
    );
  } finally {
    s.sqlite.close();
  }
});
test("weekly general activities reuse the occurrence engine and inherit description and time", () => {
  const s = setup();
  try {
    const key = randomUUID(),
      c = {
        action: "generalScheduleSave",
        version: 0,
        effectiveFrom: "2026-11-04",
        config: { ...config, weekday: 3 },
      };
    const id = send(s, c, now, key);
    assert.equal(send(s, c, now, key), id);
    for (let i = 0; i < 3; i++)
      ensureOccurrences(s, "2026-11-01", "2026-11-30", now);
    const rows = s.db
      .select()
      .from(tasks)
      .all()
      .filter((t) => t.templateId === id);
    assert.deepEqual(
      rows.map((t) => t.occurrenceDate),
      ["2026-11-04", "2026-11-11", "2026-11-18", "2026-11-25"],
    );
    assert.ok(
      rows.every(
        (t) => t.summary === config.summary && t.suggestedTime === "09:00",
      ),
    );
    assert.equal(getGeneralSchedule(s, id, now).version, 1);
    assert.throws(
      () => send(s, { ...c, effectiveFrom: "2026-11-03" }),
      /today or later/,
    );
  } finally {
    s.sqlite.close();
  }
});
test("future edits preserve history and protected exceptions while regenerating only untouched projections", () => {
  const s = setup();
  try {
    const id = recurring(s);
    ensureOccurrences(s, "2026-10-26", "2026-12-21", now);
    const rows = s.db
        .select()
        .from(tasks)
        .all()
        .filter((t) => t.templateId === id),
      on = (date: string) => rows.find((t) => t.occurrenceDate === date)!;
    send(s, {
      action: "status",
      id: on("2026-11-09").id,
      version: 1,
      status: "done",
    });
    send(s, {
      action: "status",
      id: on("2026-11-16").id,
      version: 1,
      status: "skipped",
    });
    send(s, {
      action: "moveTask",
      id: on("2026-11-23").id,
      version: 1,
      date: "2026-11-24",
      time: "12:00",
    });
    send(s, {
      action: "manual",
      id: on("2026-11-30").id,
      startedAt: now - 3600000,
      endedAt: now - 1800000,
    });
    send(s, {
      action: "edit",
      id: on("2026-12-07").id,
      version: 1,
      fields: {
        ...fields,
        title: "Edited exception",
        plannedDate: "2026-12-07",
      },
    });
    const before = rows
      .filter(
        (t) =>
          t.occurrenceDate! >= "2026-11-04" &&
          t.occurrenceDate! <= "2026-12-07",
      )
      .map((t) => task(s, t.id));
    const logged = s.db.select().from(sessions).all(),
      audit = s.db.select().from(completions).all();
    const c = {
      action: "generalScheduleSave",
      templateId: id,
      version: 1,
      effectiveFrom: "2026-11-04",
      config: { ...config, title: "Updated plan", time: "10:00" },
    };
    send(s, c);
    assert.throws(() => send(s, c), /schedule changed/);
    ensureOccurrences(s, "2026-10-26", "2026-12-21", now);
    ensureOccurrences(s, "2026-10-26", "2026-12-21", now);
    for (const t of before) assert.deepEqual(task(s, t.id), t);
    assert.equal(task(s, on("2026-11-02").id).title, config.title);
    assert.deepEqual(s.db.select().from(sessions).all(), logged);
    assert.deepEqual(s.db.select().from(completions).all(), audit);
    const refreshed = s.db
      .select()
      .from(tasks)
      .all()
      .filter((t) => t.templateId === id);
    assert.equal(refreshed.length, rows.length);
    assert.equal(
      refreshed.find((t) => t.occurrenceDate === "2026-12-14")?.title,
      "Updated plan",
    );
    assert.equal(
      refreshed.find((t) => t.occurrenceDate === "2026-11-23")?.plannedDate,
      "2026-11-24",
    );
  } finally {
    s.sqlite.close();
  }
});
test("weekday changes preserve prior dates and reject retroactive or roadmap schedule edits", () => {
  const s = setup();
  try {
    const id = recurring(s);
    ensureOccurrences(s, "2026-10-26", "2026-11-30", now);
    send(s, {
      action: "generalScheduleSave",
      templateId: id,
      version: 1,
      effectiveFrom: "2026-11-04",
      config: { ...config, weekday: 5 },
    });
    ensureOccurrences(s, "2026-10-26", "2026-11-30", now);
    const dates = s.db
      .select()
      .from(tasks)
      .all()
      .filter((t) => t.templateId === id)
      .map((t) => t.plannedDate)
      .sort();
    assert.deepEqual(dates, [
      "2026-10-26",
      "2026-11-02",
      "2026-11-06",
      "2026-11-13",
      "2026-11-20",
      "2026-11-27",
    ]);
    const map = send(s, {
      action: "roadmapCreate",
      title: "DSA",
      schedule: {
        weekdays: [3],
        time: null,
        minutes: 60,
        paused: false,
        removed: false,
      },
    });
    const study = getDashboard(s, "2026-11-04", "2026-11-04", now).tasks.find(
      (t) => t.studyRoadmap?.id === map,
    )!;
    assert.throws(
      () => getGeneralSchedule(s, study.templateId!, now),
      /roadmap/,
    );
    assert.throws(
      () =>
        send(s, {
          action: "generalScheduleSave",
          templateId: id,
          version: 2,
          effectiveFrom: "2026-11-03",
          config,
        }),
      /today or later/,
    );
  } finally {
    s.sqlite.close();
  }
});
test("moves preserve identity, occurrence origin, running time and completion history", () => {
  const s = setup();
  try {
    const series = recurring(s);
    ensureOccurrences(s, "2026-11-02", "2026-11-02", now);
    const t = s.db
      .select()
      .from(tasks)
      .all()
      .find((t) => t.templateId === series)!;
    const sessionId = send(s, { action: "start", id: t.id });
    const version = task(s, t.id).version;
    const key = randomUUID(),
      c = {
        action: "moveTask",
        id: t.id,
        version,
        date: "2026-11-06",
        time: "13:00",
      };
    send(s, c, now, key);
    send(s, c, now, key);
    assert.equal(task(s, t.id).occurrenceDate, "2026-11-02");
    assert.equal(
      s.db.select().from(sessions).where(eq(sessions.id, sessionId)).get()
        ?.endedAt,
      null,
    );
    assert.throws(() => send(s, c), /changed on another device/);
    send(
      s,
      {
        action: "status",
        id: t.id,
        version: task(s, t.id).version,
        status: "done",
        stopRunning: true,
      },
      now + 60000,
    );
    const logs = s.db.select().from(sessions).all(),
      audit = s.db.select().from(completions).all();
    send(s, {
      action: "moveTask",
      id: t.id,
      version: task(s, t.id).version,
      date: "2026-11-07",
      time: null,
    });
    ensureOccurrences(s, "2026-11-02", "2026-11-02", now);
    assert.equal(
      s.db
        .select()
        .from(tasks)
        .all()
        .filter(
          (t) => t.templateId === series && t.occurrenceDate === "2026-11-02",
        ).length,
      1,
    );
    assert.equal(task(s, t.id).status, "done");
    assert.deepEqual(s.db.select().from(sessions).all(), logs);
    assert.deepEqual(s.db.select().from(completions).all(), audit);
  } finally {
    s.sqlite.close();
  }
});
test("fixed event moves preserve duration and reject ambiguous daylight-saving times", () => {
  const s = setup();
  try {
    const id = send(s, {
      action: "create",
      fields: {
        ...fields,
        mode: "fixed",
        plannedDate: "2026-10-30",
        fixedStart: Date.parse("2026-10-30T13:00Z"),
        fixedEnd: Date.parse("2026-10-30T14:30Z"),
      },
    });
    send(s, {
      action: "moveTask",
      id,
      version: 1,
      date: "2026-11-04",
      time: "09:00",
    });
    assert.equal(task(s, id).fixedStart, Date.parse("2026-11-04T14:00Z"));
    assert.equal(task(s, id).fixedEnd! - task(s, id).fixedStart!, 90 * 60000);
    assert.throws(
      () =>
        send(s, {
          action: "moveTask",
          id,
          version: 2,
          date: "2026-11-01",
          time: "01:30",
        }),
      /unambiguous/,
    );
    assert.equal(task(s, id).version, 2);
  } finally {
    s.sqlite.close();
  }
});
test("Quick Add study sessions inherit roadmap color, reuse open activities and preserve mastery", () => {
  const s = setup();
  try {
    const map = send(s, {
      action: "roadmapCreate",
      title: "Custom roadmap",
      color: "blue",
    });
    send(s, {
      action: "roadmapChange",
      id: map,
      version: 1,
      operation: { kind: "sectionAdd", title: "Module" },
    });
    let roadmap = getLearning(s).roadmaps.find((m) => m.id === map)!;
    send(s, {
      action: "roadmapChange",
      id: map,
      version: roadmap.version,
      operation: {
        kind: "stepAdd",
        sectionId: roadmap.sections[0].id,
        title: "Step",
        resourceUrl: "",
      },
    });
    roadmap = getLearning(s).roadmaps.find((m) => m.id === map)!;
    const stepId = roadmap.sections[0].steps[0].id,
      c = {
        action: "studyTask",
        roadmapId: map,
        stepId,
        date: "2026-11-04",
        time: "10:00",
        minutes: 45,
      };
    const id = send(s, c);
    assert.equal(send(s, c), id);
    const row = getDashboard(s, "2026-11-04", "2026-11-04", now).tasks.find(
      (t) => t.id === id,
    )!;
    assert.equal(row.title, "Custom roadmap");
    assert.equal(row.studyRoadmap?.color, "blue");
    assert.equal(row.learning?.topic?.stepId, stepId);
    assert.equal(row.targetMinutes, 45);
    send(s, { action: "status", id, version: row.version, status: "done" });
    assert.equal(
      getLearning(s).roadmaps.find((m) => m.id === map)!.sections[0].steps[0]
        .completed,
      false,
    );
  } finally {
    s.sqlite.close();
  }
});
