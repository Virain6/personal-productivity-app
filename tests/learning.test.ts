import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { openDatabase, type Store } from "../src/server/db/connection";
import * as schema from "../src/server/db/schema";
import { seed } from "./legacy-seed";
import { mutate } from "../src/server/services/mutations";
import { getLearning } from "../src/server/services/learning";
import {
  roadmapProgress,
  categoryName,
  filterRoadmaps,
  learningSummary,
} from "../src/lib/learning-types";
const now = Date.parse("2026-10-28T16:00:00Z");
function setup() {
  const s = openDatabase(":memory:");
  seed(s, now);
  return s;
}
function command(s: Store, c: unknown, key = randomUUID()) {
  return mutate(s, { operationKey: key, command: c }, now);
}
function create(s: Store) {
  return command(s, {
    action: "roadmapCreate",
    title: "CS",
    category: "Fundamentals",
  }).id!;
}
function view(s: Store, id: string) {
  return getLearning(s).roadmaps.find((m) => m.id === id)!;
}
function change(s: Store, id: string, operation: unknown) {
  return command(s, {
    action: "roadmapChange",
    id,
    version: view(s, id).version,
    operation,
  });
}
test("roadmap CRUD, manual mastery, current topic, undo and archive preserve records", () => {
  const s = setup();
  try {
    const id = create(s);
    assert.equal(roadmapProgress(view(s, id).sections).percent, 0);
    change(s, id, {
      kind: "edit",
      title: "CS basics",
      category: "Fundamentals",
    });
    change(s, id, { kind: "sectionAdd", title: "OS" });
    const section = view(s, id).sections[0].id;
    change(s, id, {
      kind: "stepAdd",
      sectionId: section,
      title: "Threads",
      resourceUrl: "https://example.com/threads",
    });
    const step = view(s, id).sections[0].steps[0].id;
    change(s, id, { kind: "current", id: step });
    assert.equal(view(s, id).currentStepId, step);
    assert.equal(roadmapProgress(view(s, id).sections).completed, 0);
    change(s, id, { kind: "complete", id: step, completed: true });
    assert.equal(roadmapProgress(view(s, id).sections).percent, 100);
    assert.equal(roadmapProgress(view(s, id).sections).next, null);
    change(s, id, { kind: "complete", id: step, completed: false });
    assert.equal(roadmapProgress(view(s, id).sections).next?.id, step);
    change(s, id, {
      kind: "stepEdit",
      id: step,
      title: "Processes",
      resourceUrl: "",
    });
    change(s, id, {
      kind: "sectionEdit",
      id: section,
      title: "Operating Systems",
    });
    change(s, id, { kind: "archive", archived: true });
    assert.throws(
      () => change(s, id, { kind: "sectionAdd", title: "bad" }),
      /Restore/,
    );
    change(s, id, { kind: "archive", archived: false });
    change(s, id, { kind: "stepDelete", id: step });
    assert.equal(view(s, id).currentStepId, null);
    assert.equal(view(s, id).sections[0].steps.length, 0);
    assert.ok(
      s.sqlite.prepare("SELECT id FROM learning_steps WHERE id=?").get(step),
    );
    change(s, id, { kind: "sectionDelete", id: section });
    assert.equal(view(s, id).sections.length, 0);
    assert.ok(
      s.sqlite
        .prepare("SELECT id FROM roadmap_sections WHERE id=?")
        .get(section),
    );
  } finally {
    s.sqlite.close();
  }
});
test("ordering determines recommendation, rejects duplicates, foreign children and stale changes", () => {
  const s = setup();
  try {
    const id = create(s),
      other = create(s);
    change(s, id, { kind: "sectionAdd", title: "First" });
    change(s, id, { kind: "sectionAdd", title: "Second" });
    let m = view(s, id);
    const [a, b] = m.sections;
    for (const title of ["One", "Two"])
      change(s, id, {
        kind: "stepAdd",
        sectionId: a.id,
        title,
        resourceUrl: "",
      });
    m = view(s, id);
    const ids = m.sections[0].steps.map((s) => s.id);
    change(s, id, {
      kind: "reorder",
      sectionId: a.id,
      ids: [...ids].reverse(),
    });
    assert.equal(roadmapProgress(view(s, id).sections).next?.title, "Two");
    assert.throws(
      () =>
        change(s, id, {
          kind: "reorder",
          sectionId: a.id,
          ids: [ids[0], ids[0]],
        }),
      /exactly once/,
    );
    assert.throws(
      () => change(s, other, { kind: "current", id: ids[0] }),
      /not in this roadmap/,
    );
    assert.throws(() =>
      change(s, id, {
        kind: "stepEdit",
        id: ids[0],
        title: "x",
        resourceUrl: "javascript:alert(1)",
      }),
    );
    change(s, id, { kind: "reorder", sectionId: null, ids: [b.id, a.id] });
    assert.equal(view(s, id).sections[0].id, b.id);
    assert.throws(
      () =>
        command(s, {
          action: "roadmapChange",
          id,
          version: 1,
          operation: { kind: "archive", archived: true },
        }),
      /changed/,
    );
    change(s, id, { kind: "current", id: ids[0] });
    change(s, id, { kind: "sectionDelete", id: a.id });
    assert.equal(view(s, id).currentStepId, null);
  } finally {
    s.sqlite.close();
  }
});
test("roadmap creates and changes are receipt-safe", () => {
  const s = setup();
  try {
    const key = randomUUID(),
      c = { action: "roadmapCreate", title: "SQL", category: "Databases" };
    assert.deepEqual(command(s, c, key), command(s, c, key));
    assert.equal(getLearning(s).roadmaps.length, 1);
  } finally {
    s.sqlite.close();
  }
});
for (const oldCount of [3, 4, 5, 6, 7, 8, 9, 10])
  test(`additive migration preserves existing data from ${oldCount} migrations`, () => {
    const root = mkdtempSync(join(tmpdir(), "planner-learning-upgrade-")),
      folder = join(root, "old");
    mkdirSync(join(folder, "meta"), { recursive: true });
    const journal = JSON.parse(
      readFileSync("drizzle/meta/_journal.json", "utf8"),
    );
    journal.entries = journal.entries.slice(0, oldCount);
    writeFileSync(join(folder, "meta/_journal.json"), JSON.stringify(journal));
    for (const e of journal.entries)
      copyFileSync(`drizzle/${e.tag}.sql`, join(folder, `${e.tag}.sql`));
    const path = join(root, "old.db"),
      db = new Database(path);
    try {
      migrate(drizzle(db), { migrationsFolder: folder });
      db.exec(
        "INSERT INTO settings VALUES(1,'America/Toronto','2026-10-28'); INSERT INTO habits (id,created_date,created_at,updated_at) VALUES('preserve','2026-10-28',1,1)",
      );
      const oldStore: Store = { sqlite: db, db: drizzle(db, { schema }) };
      seed(oldStore, now);
      db.exec(
        "INSERT INTO tasks(id,planned_date,title,category,target_minutes,created_at,updated_at) VALUES('legacy-task','2026-10-28','Existing study','Fundamentals',60,1,1); INSERT INTO time_sessions(id,task_id,started_at,source) VALUES('legacy-session','legacy-task',1,'timer')",
      );
      if (oldCount >= 4)
        db.exec(
          "INSERT INTO roadmaps(id,title,category,created_at) VALUES('old-map','Existing roadmap','Fundamentals',1); INSERT INTO roadmap_sections(id,roadmap_id,title,position) VALUES('old-section','old-map','Existing section',0); INSERT INTO learning_steps(id,section_id,title,position,completed) VALUES('old-step','old-section','Existing step',0,1)",
        );
      if (oldCount >= 6)
        db.exec(
          "UPDATE learning_steps SET status='completed' WHERE completed=1",
        );
      if (oldCount >= 5)
        db.exec(
          "INSERT INTO session_learning(session_id,step_id,roadmap_id,roadmap_title,section_title,step_title) VALUES('legacy-session','old-step','old-map','Existing roadmap','Existing section','Existing step')",
        );
      if (oldCount >= 7)
        db.exec("UPDATE session_learning SET section_id='old-section'");
      if (oldCount >= 10)
        db.exec(
          "INSERT INTO weekly_reviews(week,wins,updated_at) VALUES('2026-10-26','Retain reflection',1)",
        );
      const tables = (
        db
          .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name!='__drizzle_migrations'",
          )
          .all() as { name: string }[]
      ).map((r) => r.name);
      const columns = tables.map((t) =>
        (db.prepare(`PRAGMA table_info("${t}")`).all() as { name: string }[])
          .map((c) => `"${c.name}"`)
          .join(","),
      );
      const before = tables.map((t) =>
        db.prepare(`SELECT * FROM "${t}"`).all(),
      );
      db.close();
      const upgraded = openDatabase(path);
      try {
        assert.deepEqual(
          tables.map((t, index) =>
            upgraded.sqlite
              .prepare(`SELECT ${columns[index]} FROM "${t}"`)
              .all(),
          ),
          before,
        );
        if (oldCount >= 5)
          assert.equal(
            getLearning(upgraded).studyHistory[0].sectionId,
            "old-section",
          );
        if (oldCount >= 4)
          assert.equal(
            getLearning(upgraded).roadmaps[0].sections[0].steps[0].status,
            "completed",
          );
        assert.equal(
          upgraded.sqlite.pragma("integrity_check", { simple: true }),
          "ok",
        );
        assert.deepEqual(upgraded.sqlite.pragma("foreign_key_check"), []);
        assert.equal(
          getLearning(upgraded).roadmaps.length,
          oldCount >= 4 ? 1 : 0,
        );
      } finally {
        upgraded.sqlite.close();
      }
    } finally {
      if (db.open) db.close();
      rmSync(root, { recursive: true, force: true });
    }
  });

test("category time uses closed study sessions and never changes mastery", () => {
  const s = setup();
  try {
    const id = create(s);
    const task = command(s, {
      action: "create",
      fields: {
        title: "Study",
        category: "Fundamentals",
        plannedDate: "2026-10-28",
        mode: "flexible",
        suggestedTime: null,
        targetMinutes: 60,
        fixedStart: null,
        fixedEnd: null,
        optional: false,
        summary: "",
      },
    }).id!;
    command(s, {
      action: "manual",
      id: task,
      startedAt: now - 3600000,
      endedAt: now - 1800000,
      summary: "Read about processes",
      overlapConfirmed: false,
    });
    const stat = getLearning(s).categories.find(
      (c) => c.category === "Fundamentals",
    )!;
    assert.equal(stat.trackedMs, 1800000);
    assert.equal(stat.lastStudied, "2026-10-28");
    command(s, { action: "start", id: task });
    assert.equal(
      getLearning(s).categories.find((c) => c.category === "Fundamentals")!
        .trackedMs,
      1800000,
    );
    assert.equal(roadmapProgress(view(s, id).sections).completed, 0);
  } finally {
    s.sqlite.close();
  }
});

test("custom categories, multiple roadmaps, metadata, goals, dates and archived editing", () => {
  const s = setup();
  try {
    const fields = {
      action: "roadmapCreate",
      title: "Advanced algorithms",
      category: "DSA",
      description: "Custom plan",
      goal: "Explain tradeoffs",
      targetDate: "2026-12-31",
    };
    const id = command(s, fields).id!,
      other = command(s, fields).id!;
    assert.notEqual(id, other);
    assert.equal(view(s, id).category, "DSA");
    assert.equal(view(s, id).goal, fields.goal);
    assert.equal(view(s, id).targetDate, fields.targetDate);
    change(s, id, {
      kind: "sectionAdd",
      title: "Graphs",
      description: "Connections",
      objective: "Model networks",
      resourceUrl: "https://example.com/graphs",
    });
    const section = view(s, id).sections[0];
    assert.equal(section.objective, "Model networks");
    change(s, id, {
      kind: "stepAdd",
      sectionId: section.id,
      title: "Shortest path",
      description: "Weighted graphs",
      objective: "Implement Dijkstra",
      resourceUrl: "",
    });
    const step = view(s, id).sections[0].steps[0];
    assert.equal(step.description, "Weighted graphs");
    change(s, id, {
      kind: "stepEdit",
      id: step.id,
      title: "Dijkstra",
      resourceUrl: "",
    });
    assert.equal(
      view(s, id).sections[0].steps[0].objective,
      "Implement Dijkstra",
    );
    change(s, id, { kind: "archive", archived: true });
    change(s, id, {
      kind: "edit",
      title: "Algorithms",
      category: "Interview preparation",
      goal: "",
      targetDate: null,
    });
    assert.equal(view(s, id).description, "Custom plan");
    assert.equal(view(s, id).targetDate, null);
    assert.equal(view(s, id).archived, true);
    change(s, id, { kind: "archive", archived: false });
    assert.equal(view(s, id).sections[0].steps[0].title, "Dijkstra");
    for (const override of [
      { category: " " },
      { targetDate: "2026-02-30" },
      { description: "x".repeat(2001) },
      { goal: "x".repeat(501) },
    ])
      assert.throws(() => command(s, { ...fields, ...override }));
    assert.throws(() =>
      change(s, id, {
        kind: "sectionEdit",
        id: section.id,
        title: "Graph",
        resourceUrl: "javascript:alert(1)",
      }),
    );
  } finally {
    s.sqlite.close();
  }
});
test("explicit status transitions preserve completion compatibility and recommendations", () => {
  const s = setup();
  try {
    const id = create(s);
    change(s, id, { kind: "sectionAdd", title: "Systems" });
    const section = view(s, id).sections[0].id;
    for (const title of ["Memory", "Processes"])
      change(s, id, {
        kind: "stepAdd",
        sectionId: section,
        title,
        resourceUrl: "",
      });
    const first = view(s, id).sections[0].steps[0].id;
    for (const status of [
      "in_progress",
      "needs_review",
      "completed",
      "not_started",
    ]) {
      change(s, id, { kind: "status", id: first, status });
      const m = view(s, id),
        step = m.sections[0].steps[0];
      assert.equal(step.status, status);
      assert.equal(step.completed, status === "completed");
      assert.equal(
        roadmapProgress(m.sections).completed,
        status === "completed" ? 1 : 0,
      );
    }
    change(s, id, { kind: "complete", id: first, completed: true });
    assert.equal(view(s, id).sections[0].steps[0].status, "completed");
    change(s, id, { kind: "complete", id: first, completed: false });
    assert.equal(view(s, id).sections[0].steps[0].status, "not_started");
    assert.throws(() =>
      change(s, id, { kind: "status", id: first, status: "mastered" }),
    );
  } finally {
    s.sqlite.close();
  }
});

test("overview filters and summaries use real stored progress and closed sessions", () => {
  const s = setup();
  try {
    const id = create(s),
      other = command(s, {
        action: "roadmapCreate",
        title: "Rust",
        category: "Languages",
        description: "Ownership",
      }).id!;
    change(s, id, { kind: "sectionAdd", title: "OS" });
    const section = view(s, id).sections[0].id;
    change(s, id, {
      kind: "stepAdd",
      sectionId: section,
      title: "Memory",
      resourceUrl: "",
    });
    const step = view(s, id).sections[0].steps[0].id;
    change(s, id, { kind: "complete", id: step, completed: true });
    const data = getLearning(s);
    assert.deepEqual(
      filterRoadmaps(data.roadmaps, " ownership ", "Languages").map(
        (m) => m.id,
      ),
      [other],
    );
    assert.equal(filterRoadmaps(data.roadmaps, "missing", "").length, 0);
    assert.equal(filterRoadmaps(data.roadmaps, "", "Fundamentals").length, 1);
    data.studyHistory = [
      {
        sessionId: "closed",
        stepId: step,
        roadmapId: id,
        roadmapTitle: "CS",
        sectionTitle: "OS",
        stepTitle: "Memory",
        version: 1,
        summary: "",
        startedAt: now - 60000,
        endedAt: now,
      },
      {
        sessionId: "running",
        stepId: step,
        roadmapId: id,
        roadmapTitle: "CS",
        sectionTitle: "OS",
        stepTitle: "Memory",
        version: 1,
        summary: "",
        startedAt: now,
        endedAt: null,
      },
    ];
    assert.deepEqual(learningSummary(data), {
      active: 2,
      completed: 1,
      studiedMs: 60000,
    });
    data.roadmaps.find((m) => m.id === id)!.archived = true;
    assert.equal(filterRoadmaps(data.roadmaps, "", "").length, 1);
    assert.deepEqual(learningSummary(data), {
      active: 1,
      completed: 0,
      studiedMs: 60000,
    });
    assert.equal(categoryName("constructor"), "constructor");
    assert.equal(categoryName("__proto__"), "__proto__");
  } finally {
    s.sqlite.close();
  }
});
