import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { openDatabase, type Store } from "../src/server/db/connection";
import { seed, ensureOccurrences } from "./legacy-seed";
import { mutate } from "../src/server/services/mutations";
import { getLearning } from "../src/server/services/learning";
import { getDashboard } from "../src/server/services/dashboard";
import { getModuleActivity } from "../src/server/services/module-activity";
import type { StudyScheduleConfig } from "../src/lib/module-types";
const now = Date.parse("2026-10-26T14:00:00Z");
const config: StudyScheduleConfig = {
  weekdays: [1, 3, 5],
  time: "09:00",
  minutes: 45,
  paused: false,
  removed: false,
};
function send(s: Store, c: unknown, at = now, key = randomUUID()) {
  return mutate(s, { operationKey: key, command: c }, at).id!;
}
function setup() {
  const s = openDatabase(":memory:");
  seed(s, now);
  const map = send(s, {
    action: "roadmapCreate",
    title: "CS",
    category: "Fundamentals",
  });
  const change = (operation: unknown, at = now) =>
    send(
      s,
      {
        action: "roadmapChange",
        id: map,
        version: getLearning(s).roadmaps[0].version,
        operation,
      },
      at,
    );
  change({ kind: "sectionAdd", title: "Operating Systems" });
  change({ kind: "sectionAdd", title: "Networks" });
  const sections = getLearning(s).roadmaps[0].sections;
  for (const section of sections)
    for (const title of ["First", "Second"])
      change({
        kind: "stepAdd",
        sectionId: section.id,
        title,
        resourceUrl: "",
      });
  return {
    s,
    map,
    section: sections[0].id,
    other: sections[1].id,
    step: getLearning(s).roadmaps[0].sections[0].steps[0].id,
    change,
  };
}
function rows(s: Store, section: string) {
  return s.sqlite
    .prepare(
      "SELECT t.* FROM tasks t JOIN task_study x ON x.task_id=t.id WHERE x.roadmap_id=(SELECT roadmap_id FROM roadmap_sections WHERE id=?) AND x.cancelled=0 ORDER BY t.occurrence_date,t.id",
    )
    .all(section) as {
    id: string;
    occurrence_date: string;
    planned_date: string;
    target_minutes: number;
    suggested_time: string | null;
    version: number;
    status: string;
  }[];
}
function schedule(
  s: Store,
  map: string,
  sectionId: string | null,
  cfg = config,
  at = now,
  templateId?: string,
) {
  const existing = getModuleActivity(
    s,
    map,
    sectionId,
    "2026-10",
    at,
  ).schedules.find((x) => x.sectionId === null);
  return send(
    s,
    {
      action: "studyScheduleSave",
      roadmapId: map,
      sectionId: null,
      config: cfg,
      id: existing?.id,
      version: existing?.version,
      templateId,
    },
    at,
  );
}
test("roadmap schedule uses existing templates, receipts and occurrence identities without duplicates", () => {
  const { s, map, section } = setup();
  try {
    ensureOccurrences(s, "2026-10-26", "2026-11-02", now);
    const before = s.sqlite
      .prepare(
        "SELECT id FROM tasks WHERE template_id='default-1-focus' AND occurrence_date='2026-10-26'",
      )
      .get() as { id: string };
    const c = {
      action: "studyScheduleSave",
      roadmapId: map,
      sectionId: null,
      templateId: "default-1-focus",
      config,
    };
    const key = randomUUID();
    const id = send(s, c, now, key);
    assert.equal(send(s, c, now, key), id);
    for (let i = 0; i < 3; i++)
      ensureOccurrences(s, "2026-10-26", "2026-11-02", now);
    const tasks = rows(s, section);
    assert.equal(tasks.length, 4);
    assert.equal(tasks[0].id, before.id);
    assert.equal(new Set(tasks.map((t) => t.id)).size, 4);
    assert.equal(tasks[0].target_minutes, 45);
    assert.throws(
      () =>
        send(s, { ...c, sectionId: getLearning(s).roadmaps[0].sections[1].id }),
      /roadmap/,
    );
    assert.throws(() => send(s, { ...c, id, version: 99 }), /changed/);
    assert.deepEqual(s.sqlite.pragma("foreign_key_check"), []);
  } finally {
    s.sqlite.close();
  }
});
test("schedule revisions preserve past, moved, completed, logged and explicitly linked occurrences", () => {
  const { s, map, section, step } = setup();
  try {
    schedule(s, map, section);
    ensureOccurrences(s, "2026-10-26", "2026-11-06", now);
    const initial = rows(s, section);
    const first = initial[0];
    send(s, {
      action: "status",
      id: first.id,
      version: first.version,
      status: "done",
      stopRunning: false,
    });
    const moved = initial[1];
    s.sqlite
      .prepare(
        "UPDATE tasks SET planned_date='2026-10-29', version=version+1 WHERE id=?",
      )
      .run(moved.id);
    const linked = initial[2];
    send(s, { action: "taskTopic", id: linked.id, stepId: step, version: 0 });
    const before = s.sqlite
      .prepare("SELECT * FROM tasks WHERE id=?")
      .get(first.id);
    const later = Date.parse("2026-10-27T14:00:00Z");
    schedule(
      s,
      map,
      section,
      { ...config, weekdays: [2], time: null, minutes: 30 },
      later,
    );
    ensureOccurrences(s, "2026-10-26", "2026-11-06", later);
    assert.deepEqual(
      s.sqlite.prepare("SELECT * FROM tasks WHERE id=?").get(first.id),
      before,
    );
    assert.ok(
      rows(s, section).some(
        (t) => t.id === moved.id && t.planned_date === "2026-10-29",
      ),
    );
    assert.ok(rows(s, section).some((t) => t.id === linked.id));
    const removed = initial.find((t) => t.occurrence_date === "2026-11-02")!;
    assert.ok(
      !getDashboard(s, "2026-11-02", "2026-11-02", later).tasks.some(
        (t) => t.id === removed.id,
      ),
    );
    assert.throws(
      () => send(s, { action: "start", id: removed.id }, later),
      /cancelled/,
    );
    schedule(s, map, section, config, later);
    ensureOccurrences(s, "2026-11-02", "2026-11-02", later);
    assert.equal(
      rows(s, section).find((t) => t.occurrence_date === "2026-11-02")?.id,
      removed.id,
    );
  } finally {
    s.sqlite.close();
  }
});
test("pause, removal and restore retain history and do not create retroactive missed days", () => {
  const { s, map, section } = setup();
  try {
    schedule(s, map, section);
    ensureOccurrences(s, "2026-10-26", "2026-11-06", now);
    const original = rows(s, section)[0];
    schedule(
      s,
      map,
      section,
      { ...config, paused: true },
      Date.parse("2026-10-27T14:00:00Z"),
    );
    let data = getModuleActivity(
      s,
      map,
      null,
      "2026-10",
      Date.parse("2026-10-30T14:00:00Z"),
    );
    assert.equal(data.days.find((d) => d.date === "2026-10-28")?.scheduled, 0);
    assert.equal(data.days.find((d) => d.date === "2026-10-26")?.scheduled, 1);
    schedule(
      s,
      map,
      section,
      { ...config, removed: true },
      Date.parse("2026-10-30T14:00:00Z"),
    );
    schedule(s, map, section, config, Date.parse("2026-11-02T14:00:00Z"));
    data = getModuleActivity(
      s,
      map,
      null,
      "2026-10",
      Date.parse("2026-11-02T14:00:00Z"),
    );
    assert.equal(data.days.find((d) => d.date === "2026-10-30")?.scheduled, 0);
    assert.ok(rows(s, section).some((t) => t.id === original.id));
  } finally {
    s.sqlite.close();
  }
});
test("module time, monthly consistency, unscheduled study and historical labels stay independent of mastery", () => {
  const { s, map, section, other, step, change } = setup();
  try {
    schedule(s, map, section);
    ensureOccurrences(s, "2026-10-26", "2026-10-30", now);
    const task = rows(s, section)[0];
    const later = Date.parse("2026-10-30T20:00:00Z");
    send(
      s,
      {
        action: "manual",
        id: task.id,
        stepId: step,
        startedAt: Date.parse("2026-10-27T14:00:00Z"),
        endedAt: Date.parse("2026-10-27T14:30:00Z"),
      },
      later,
    );
    send(
      s,
      {
        action: "status",
        id: task.id,
        version: task.version,
        status: "done",
        stopRunning: false,
      },
      later,
    );
    change({ kind: "complete", id: step, completed: true }, later);
    change({ kind: "sectionEdit", id: section, title: "Renamed OS" }, later);
    let data = getModuleActivity(s, map, section, "2026-10", later);
    assert.equal(data.totals.studiedMs, 1800000);
    assert.equal(data.totals.sessions, 1);
    assert.equal(
      data.days.find((d) => d.date === "2026-10-27")?.state,
      "unscheduled",
    );
    assert.equal(
      getModuleActivity(s, map, null, "2026-10", later).monthStats.eligibleDays,
      2,
    );
    assert.equal(
      getModuleActivity(s, map, null, "2026-10", later).monthStats.consistency,
      50,
    );
    assert.equal(data.days.find((d) => d.date === "2026-10-30")?.state, "rest");
    assert.equal(
      getModuleActivity(s, map, other, "2026-10", later).totals.sessions,
      0,
    );
    change({ kind: "sectionArchive", id: section, archived: true }, later);
    data = getModuleActivity(s, map, section, "2026-10", later);
    assert.equal(data.totals.sessions, 1);
    assert.equal(
      getLearning(s).studyHistory[0].sectionTitle,
      "Operating Systems",
    );
    assert.equal(data.schedules[0].config.paused, false);
    change({ kind: "sectionArchive", id: section, archived: false }, later);
    assert.equal(
      getModuleActivity(s, map, section, "2026-10", later).schedules[0].config
        .paused,
      false,
    );
  } finally {
    s.sqlite.close();
  }
});
test("roadmap and module recommendations inherit dynamically while sessions snapshot actual topics", () => {
  const { s, map, section, other, step, change } = setup();
  try {
    schedule(s, map, null);
    ensureOccurrences(s, "2026-10-26", "2026-10-26", now);
    const task = rows(s, section)[0];
    const session = send(s, { action: "start", id: task.id });
    send(s, { action: "stop", sessionId: session }, now + 60000);
    const next = getLearning(s).roadmaps[0].sections[0].steps[1].id;
    change({ kind: "current", id: next });
    assert.equal(
      getDashboard(s, "2026-10-26", "2026-10-26", now + 60000).tasks.find(
        (t) => t.id === task.id,
      )?.learning?.topic?.stepId,
      next,
    );
    assert.equal(getLearning(s).studyHistory[0].stepId, step);
    const otherStep = getLearning(s).roadmaps[0].sections.find(
      (x) => x.id === other,
    )!.steps[0].id;
    change({ kind: "current", id: otherStep });
    assert.equal(
      getDashboard(s, "2026-10-26", "2026-10-26", now + 60000).tasks.find(
        (t) => t.id === task.id,
      )?.learning?.topic?.sectionId,
      other,
    );
    const extra = send(s, {
      action: "studyTask",
      stepId: next,
      date: "2026-10-31",
      time: null,
      minutes: 20,
    });
    assert.ok(
      getDashboard(s, "2026-10-31", "2026-10-31", now).tasks.some(
        (t) => t.id === extra && t.learning?.topic?.stepId === next,
      ),
    );
  } finally {
    s.sqlite.close();
  }
});
test("local midnight and DST split recorded time without inventing study from completion", () => {
  const { s, map, section, step } = setup();
  try {
    const task = send(s, {
      action: "studyTask",
      stepId: step,
      date: "2026-10-31",
      minutes: 60,
      time: null,
    });
    const later = Date.parse("2026-11-02T18:00:00Z");
    send(
      s,
      {
        action: "manual",
        id: task,
        stepId: step,
        startedAt: Date.parse("2026-11-01T03:30:00Z"),
        endedAt: Date.parse("2026-11-01T06:30:00Z"),
      },
      later,
    );
    const oct = getModuleActivity(s, map, section, "2026-10", later),
      nov = getModuleActivity(s, map, section, "2026-11", later);
    assert.equal(oct.monthStats.studiedMs, 30 * 60000);
    assert.equal(nov.monthStats.studiedMs, 150 * 60000);
    assert.equal(oct.monthStats.sessions, 1);
    assert.equal(nov.monthStats.sessions, 0);
    assert.equal(nov.days[0].state, "unscheduled");
    assert.equal(oct.totals.studiedMs, 180 * 60000);
  } finally {
    s.sqlite.close();
  }
});

test("logged future occurrences survive removal, and roadmap-only sessions do not infer mastery", () => {
  const { s, map, section, change } = setup();
  try {
    schedule(s, map, section);
    ensureOccurrences(s, "2026-10-26", "2026-11-06", now);
    const future = rows(s, section).find(
      (t) => t.occurrence_date === "2026-11-04",
    )!;
    for (const step of getLearning(s).roadmaps[0].sections.flatMap(
      (s) => s.steps,
    ))
      change({ kind: "complete", id: step.id, completed: true });
    const session = send(s, {
      action: "manual",
      id: future.id,
      startedAt: now - 1800000,
      endedAt: now,
    });
    assert.equal(
      getLearning(s).studyHistory.find((x) => x.sessionId === session)?.stepId,
      null,
    );
    assert.equal(
      getModuleActivity(s, map, null, "2026-10", now).totals.studiedMs,
      1800000,
    );
    schedule(s, map, section, { ...config, removed: true });
    assert.ok(
      getDashboard(s, "2026-11-04", "2026-11-04", now).tasks.some(
        (t) => t.id === future.id,
      ),
    );
    assert.equal(
      getModuleActivity(s, map, null, "2026-10", now).totals.sessions,
      1,
    );
    send(s, { action: "sessionTopic", id: session, stepId: null, version: 1 });
    assert.equal(
      getModuleActivity(s, map, null, "2026-10", now).totals.sessions,
      0,
    );
    assert.equal(
      (
        s.sqlite
          .prepare(
            "SELECT ended_at-started_at AS duration FROM time_sessions WHERE id=?",
          )
          .get(session) as { duration: number }
      ).duration,
      1800000,
    );
    assert.throws(() =>
      send(s, {
        action: "studyScheduleSave",
        roadmapId: map,
        sectionId: section,
        config: { ...config, weekdays: [] },
      }),
    );
  } finally {
    s.sqlite.close();
  }
});
