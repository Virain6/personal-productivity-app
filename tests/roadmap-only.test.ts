import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { openDatabase, type Store } from "../src/server/db/connection";
import { seed, ensureOccurrences } from "../src/server/services/scheduling";
import { seed as legacySeed } from "./legacy-seed";
import { mutate } from "../src/server/services/mutations";
import { getDashboard } from "../src/server/services/dashboard";
import { getLearning } from "../src/server/services/learning";
import {
  retirementPlan,
  retireLearning,
} from "../src/server/services/retire-learning";
const now = Date.parse("2026-10-26T14:00:00Z");
const config = {
  weekdays: [1, 3],
  time: null,
  minutes: 90,
  paused: false,
  removed: false,
};
function send(s: Store, command: unknown, at = now, key = randomUUID()) {
  return mutate(s, { operationKey: key, command }, at).id!;
}
function setup() {
  const s = openDatabase(":memory:");
  seed(s, now);
  return s;
}
function learningTasks(s: Store, date = "2026-10-26") {
  return getDashboard(s, date, date, now).tasks.filter((t) => t.studyRoadmap);
}
test("optional roadmap recurrence is atomic and unscheduled roadmaps create no tasks", () => {
  const s = setup();
  try {
    const empty = send(s, { action: "roadmapCreate", title: "Unscheduled" });
    assert.equal(learningTasks(s).length, 0);
    const id = send(s, {
      action: "roadmapCreate",
      title: "DSA",
      color: "blue",
      schedule: config,
    });
    assert.equal(learningTasks(s).length, 1);
    assert.equal(learningTasks(s)[0].studyRoadmap?.id, id);
    send(s, {
      action: "roadmapChange",
      id: empty,
      version: 1,
      operation: { kind: "sectionAdd", title: "Module" },
    });
    assert.equal(learningTasks(s).length, 1);
    const before = getLearning(s).roadmaps.length;
    assert.throws(() =>
      send(s, {
        action: "roadmapCreate",
        title: "Invalid",
        schedule: { ...config, weekdays: [] },
      }),
    );
    assert.equal(getLearning(s).roadmaps.length, before);
  } finally {
    s.sqlite.close();
  }
});
test("Study Anytime reuses the date activity, allows explicit extras and retries safely", () => {
  const s = setup();
  try {
    const id = send(s, {
      action: "roadmapCreate",
      title: "DSA",
      schedule: config,
    });
    const task = learningTasks(s)[0];
    assert.equal(
      send(s, {
        action: "studyTask",
        roadmapId: id,
        stepId: null,
        date: "2026-10-26",
        time: null,
      }),
      task.id,
    );
    assert.equal(learningTasks(s).length, 1);
    const command = {
      action: "studyTask",
      roadmapId: id,
      stepId: null,
      date: "2026-10-26",
      time: null,
      additional: true,
    };
    const key = randomUUID(),
      extra = send(s, command, now, key);
    assert.equal(send(s, command, now, key), extra);
    assert.equal(learningTasks(s).length, 2);
    const saturday = send(s, {
      action: "studyTask",
      roadmapId: id,
      date: "2026-10-31",
      time: null,
    });
    assert.equal(learningTasks(s, "2026-10-31")[0].id, saturday);
    assert.equal(
      s.sqlite.prepare("SELECT count(*) FROM study_schedules").pluck().get(),
      1,
    );
  } finally {
    s.sqlite.close();
  }
});
test("start now records roadmap-only time and rolls back extra tasks on timer conflict", () => {
  const s = setup();
  try {
    const id = send(s, { action: "roadmapCreate", title: "Applied AI" });
    send(s, {
      action: "studyTask",
      roadmapId: id,
      stepId: null,
      date: "2026-10-26",
      time: null,
      startNow: true,
    });
    const session = getLearning(s).studyHistory[0];
    assert.equal(session.roadmapId, id);
    assert.equal(session.stepId, null);
    assert.throws(
      () =>
        send(s, {
          action: "studyTask",
          roadmapId: id,
          date: "2026-10-26",
          time: null,
          startNow: true,
          additional: true,
        }),
      /timer/,
    );
    assert.equal(learningTasks(s).length, 1);
    send(s, { action: "stop", sessionId: session.sessionId }, now + 60000);
    assert.equal(
      getLearning(s).studyHistory[0].endedAt! - session.startedAt,
      60000,
    );
  } finally {
    s.sqlite.close();
  }
});
test("retiring exact defaults preserves completed, logged, edited and unrelated tasks", () => {
  const s = setup();
  try {
    legacySeed(s, now);
    ensureOccurrences(s, "2026-10-26", "2026-11-06", now);
    const raw = (id: string) =>
      s.sqlite.prepare("SELECT * FROM tasks WHERE id=?").get(id);
    const rows = s.sqlite
      .prepare(
        "SELECT id FROM tasks WHERE template_id='default-1-dsa' ORDER BY occurrence_date",
      )
      .all() as { id: string }[];
    s.sqlite
      .prepare("UPDATE tasks SET status='done',version=2 WHERE id=?")
      .run(rows[0].id);
    const logged = send(s, { action: "start", id: rows[1].id });
    const edited = (
      s.sqlite
        .prepare(
          "SELECT id FROM tasks WHERE template_id='default-2-dsa' LIMIT 1",
        )
        .get() as { id: string }
    ).id;
    s.sqlite.prepare("UPDATE tasks SET version=2 WHERE id=?").run(edited);
    const before = [raw(rows[0].id), raw(rows[1].id), raw(edited)];
    const project = s.sqlite
      .prepare("SELECT * FROM tasks WHERE category='Project'")
      .all();
    const count = s.sqlite.prepare("SELECT count(*) FROM tasks").pluck().get();
    const plan = retireLearning(s, now);
    assert.equal(plan.templates.length, 15);
    assert.ok(plan.taskIds.length > 0);
    assert.deepEqual([raw(rows[0].id), raw(rows[1].id), raw(edited)], before);
    assert.deepEqual(
      s.sqlite.prepare("SELECT * FROM tasks WHERE category='Project'").all(),
      project,
    );
    assert.equal(
      s.sqlite.prepare("SELECT count(*) FROM tasks").pluck().get(),
      count,
    );
    assert.equal(
      s.sqlite
        .prepare("SELECT id FROM time_sessions WHERE id=?")
        .pluck()
        .get(logged),
      logged,
    );
    assert.equal(retirementPlan(s, now).taskIds.length, 0);
    assert.throws(
      () => send(s, { action: "start", id: plan.taskIds[0] }),
      /retired/,
    );
    seed(s, now);
    ensureOccurrences(s, "2026-12-01", "2026-12-31", now);
    assert.equal(
      s.sqlite
        .prepare(
          "SELECT count(*) FROM tasks WHERE template_id='default-1-dsa' AND occurrence_date>='2026-12-01'",
        )
        .pluck()
        .get(),
      0,
    );
  } finally {
    s.sqlite.close();
  }
});
test("legacy module recurrence is blocked and retired without deleting step study history", () => {
  const s = setup();
  try {
    const id = send(s, {
      action: "roadmapCreate",
      title: "CS",
      schedule: config,
    });
    send(s, {
      action: "roadmapChange",
      id,
      version: 1,
      operation: { kind: "sectionAdd", title: "OS" },
    });
    const section = getLearning(s).roadmaps[0].sections[0].id;
    learningTasks(s);
    // A populated prior-installation fixture, before module recurrence was removed.
    s.sqlite
      .prepare("UPDATE study_schedules SET section_id=? WHERE roadmap_id=?")
      .run(section, id);
    s.sqlite
      .prepare("UPDATE task_study SET section_id=? WHERE roadmap_id=?")
      .run(section, id);
    const tasksBefore = s.sqlite
      .prepare("SELECT count(*) FROM tasks")
      .pluck()
      .get();
    ensureOccurrences(s, "2026-12-01", "2026-12-31", now);
    assert.equal(
      s.sqlite
        .prepare("SELECT count(*) FROM task_study WHERE roadmap_id=?")
        .pluck()
        .get(id),
      9,
    );
    const plan = retireLearning(s, now);
    assert.equal(plan.moduleSchedules.length, 1);
    assert.ok(plan.taskIds.length > 0);
    assert.equal(learningTasks(s).length, 0);
    assert.ok(
      Number(s.sqlite.prepare("SELECT count(*) FROM tasks").pluck().get()) >=
        Number(tasksBefore),
    );
    assert.throws(
      () =>
        send(s, {
          action: "studyScheduleSave",
          roadmapId: id,
          sectionId: section,
          config,
        }),
      /roadmap/,
    );
    assert.deepEqual(s.sqlite.pragma("foreign_key_check"), []);
  } finally {
    s.sqlite.close();
  }
});
