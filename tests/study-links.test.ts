import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { openDatabase, type Store } from "../src/server/db/connection";
import { seed } from "./legacy-seed";
import { mutate } from "../src/server/services/mutations";
import { getLearning } from "../src/server/services/learning";
import { getDashboard } from "../src/server/services/dashboard";
import { stepStudyTime } from "../src/lib/learning-types";
import { TaskCard } from "../src/features/home/task-card";
import {
  StepSelect,
  TopicDescription,
} from "../src/features/learning/study-controls";
const now = Date.parse("2026-10-29T16:00:00Z");
function cmd(s: Store, command: unknown, at = now, key = randomUUID()) {
  return mutate(s, { operationKey: key, command }, at).id!;
}
function setup() {
  const s = openDatabase(":memory:");
  seed(s, now);
  const map = cmd(s, {
    action: "roadmapCreate",
    title: "SQL",
    category: "Databases",
  });
  function change(operation: unknown) {
    cmd(s, {
      action: "roadmapChange",
      id: map,
      version: getLearning(s).roadmaps[0].version,
      operation,
    });
  }
  change({ kind: "sectionAdd", title: "Queries" });
  const section = getLearning(s).roadmaps[0].sections[0].id;
  for (const title of ["Joins", "Indexes"])
    change({ kind: "stepAdd", sectionId: section, title, resourceUrl: "" });
  const steps = getLearning(s).roadmaps[0].sections[0].steps;
  const fields = {
    title: "SQL study",
    category: "Databases",
    plannedDate: "2026-10-29",
    mode: "flexible",
    suggestedTime: null,
    targetMinutes: 60,
    fixedStart: null,
    fixedEnd: null,
    optional: false,
    summary: "",
  };
  const task = cmd(s, { action: "create", fields });
  const other = cmd(s, {
    action: "create",
    fields: { ...fields, title: "DSA", category: "DSA" },
  });
  const manual = (stepId?: string | null, minutes = 10) =>
    cmd(s, {
      action: "manual",
      id: task,
      stepId,
      startedAt: now - 3600000,
      endedAt: now - 3600000 + minutes * 60000,
      overlapConfirmed: true,
      summary: "Study notes",
    });
  return { s, map, section, steps, task, other, change, manual };
}
test("links can be added, changed, removed and retried without altering saved time or mastery", () => {
  const { s, steps, task, manual } = setup();
  try {
    const id = manual();
    const before = s.sqlite
      .prepare("SELECT * FROM time_sessions WHERE id=?")
      .get(id);
    const key = randomUUID(),
      c = { action: "sessionTopic", id, stepId: steps[0].id, version: 0 };
    cmd(s, c, now, key);
    cmd(s, c, now, key);
    assert.equal(
      stepStudyTime(getLearning(s).studyHistory, steps[0].id),
      600000,
    );
    manual(steps[0].id, 20);
    assert.equal(
      stepStudyTime(getLearning(s).studyHistory, steps[0].id),
      1800000,
    );
    cmd(s, { action: "sessionTopic", id, stepId: steps[1].id, version: 1 });
    assert.throws(
      () => cmd(s, { action: "sessionTopic", id, stepId: null, version: 1 }),
      /changed/,
    );
    cmd(s, { action: "sessionTopic", id, stepId: null, version: 2 });
    assert.equal(
      stepStudyTime(getLearning(s).studyHistory, steps[0].id),
      1200000,
    );
    assert.equal(stepStudyTime(getLearning(s).studyHistory, steps[1].id), 0);
    assert.deepEqual(
      s.sqlite.prepare("SELECT * FROM time_sessions WHERE id=?").get(id),
      before,
    );
    assert.ok(
      getLearning(s).roadmaps[0].sections[0].steps.every((x) => !x.completed),
    );
    assert.equal(
      getDashboard(s, "2026-10-29", "2026-10-29", now).tasks.find(
        (t) => t.id === task,
      )!.actualMs,
      1800000,
    );
  } finally {
    s.sqlite.close();
  }
});
test("activity defaults, timer switch rollback, explicit overrides and ordinary DSA remain safe", () => {
  const { s, task, other, steps } = setup();
  try {
    cmd(s, { action: "taskTopic", id: task, stepId: steps[0].id, version: 0 });
    assert.throws(
      () => cmd(s, { action: "taskTopic", id: task, stepId: null, version: 0 }),
      /changed/,
    );
    const running = cmd(s, { action: "start", id: other });
    assert.throws(
      () =>
        cmd(
          s,
          { action: "switch", id: task, sessionId: running, stepId: "missing" },
          now + 60000,
        ),
      /not found/,
    );
    assert.equal(
      (
        s.sqlite
          .prepare("SELECT ended_at FROM time_sessions WHERE id=?")
          .get(running) as { ended_at: null }
      ).ended_at,
      null,
    );
    const linked = cmd(
      s,
      { action: "switch", id: task, sessionId: running },
      now + 60000,
    );
    assert.equal(
      getLearning(s).studyHistory.find((x) => x.sessionId === linked)!.stepId,
      steps[0].id,
    );
    assert.equal(stepStudyTime(getLearning(s).studyHistory, steps[0].id), 0);
    cmd(s, { action: "stop", sessionId: linked }, now + 120000);
    assert.equal(
      stepStudyTime(getLearning(s).studyHistory, steps[0].id),
      60000,
    );
    const unlinked = cmd(
      s,
      { action: "start", id: task, stepId: null },
      now + 180000,
    );
    assert.ok(
      !getLearning(s).studyHistory.some((x) => x.sessionId === unlinked),
    );
    cmd(s, {
      action: "sessionTopic",
      id: running,
      stepId: steps[0].id,
      version: 0,
    });
    assert.equal(
      getLearning(s).studyHistory.find((x) => x.sessionId === running)?.stepId,
      steps[0].id,
    );
  } finally {
    s.sqlite.close();
  }
});
test("rename, archive and soft deletion preserve historical labels and corrected time", () => {
  const { s, map, section, task, steps, change, manual } = setup();
  try {
    cmd(s, { action: "taskTopic", id: task, stepId: steps[0].id, version: 0 });
    const id = manual();
    change({
      kind: "stepEdit",
      id: steps[0].id,
      title: "Renamed",
      resourceUrl: "",
    });
    change({ kind: "sectionEdit", id: section, title: "Renamed section" });
    change({ kind: "edit", title: "Renamed roadmap", category: "Databases" });
    change({ kind: "archive", archived: true });
    let history = getLearning(s).studyHistory[0];
    assert.equal(history.stepTitle, "Joins");
    assert.equal(history.sectionTitle, "Queries");
    assert.equal(history.roadmapTitle, "SQL");
    assert.equal(history.roadmapId, map);
    cmd(s, { action: "sessionTopic", id, stepId: steps[0].id, version: 1 });
    assert.throws(() => manual(steps[0].id), /active/);
    assert.ok(
      !getLearning(s).studyHistory.some((x) => x.sessionId === manual()),
    );
    change({ kind: "archive", archived: false });
    change({ kind: "sectionDelete", id: section });
    history = getLearning(s).studyHistory[0];
    assert.equal(history.stepTitle, "Joins");
    const session = getDashboard(
      s,
      "2026-10-29",
      "2026-10-29",
      now,
    ).sessions.find((x) => x.id === id)!;
    cmd(s, {
      action: "correctSession",
      id,
      expected: {
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        summary: session.summary,
        overlapConfirmed: session.overlapConfirmed,
      },
      startedAt: session.startedAt,
      endedAt: session.startedAt + 300000,
      summary: "Corrected",
      overlapConfirmed: true,
    });
    assert.equal(
      stepStudyTime(getLearning(s).studyHistory, steps[0].id),
      300000,
    );
    assert.equal(getLearning(s).studyHistory[0].summary, "Corrected");
    assert.deepEqual(s.sqlite.pragma("foreign_key_check"), []);
  } finally {
    s.sqlite.close();
  }
});
test("Home topic and task-detail options use the saved optional association", () => {
  const { s, task, steps } = setup();
  try {
    cmd(s, { action: "taskTopic", id: task, stepId: steps[0].id, version: 0 });
    const t = getDashboard(s, "2026-10-29", "2026-10-29", now).tasks.find(
      (x) => x.id === task,
    )!;
    const html = renderToStaticMarkup(
      createElement(TaskCard, {
        task: t,
        onOpen: () => {},
        onComplete: () => {},
        busy: false,
        timezone: "America/Toronto",
      }),
    );
    assert.match(html, /Joins/);
    assert.match(html, /truncate text-\[11px\]/);
    const data = getLearning(s);
    const options = renderToStaticMarkup(
      createElement(StepSelect, {
        data,
        category: t.category,
        value: steps[0].id,
        onChange: () => {},
        label: "Topic",
      }),
    );
    assert.match(options, /No learning step/);
    assert.match(options, /Queries \/ Joins/);
    assert.match(
      renderToStaticMarkup(
        createElement(TopicDescription, { data, stepId: steps[0].id }),
      ),
      /Open SQL/,
    );
    cmd(s, { action: "taskTopic", id: task, stepId: null, version: 1 });
    assert.equal(
      getDashboard(s, "2026-10-29", "2026-10-29", now).tasks.find(
        (x) => x.id === task,
      )!.learning!.topic,
      null,
    );
  } finally {
    s.sqlite.close();
  }
});
