import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { openDatabase, type Store } from "../src/server/db/connection";
import { seed, ensureOccurrences } from "../src/server/services/scheduling";
import { seed as legacySeed } from "./legacy-seed";
import { mutate } from "../src/server/services/mutations";
import { getLearning } from "../src/server/services/learning";
import { getDashboard } from "../src/server/services/dashboard";
import { roadmapColor, roadmapColors } from "../src/lib/roadmap-colors";
const now = Date.parse("2026-10-26T14:00:00Z");
function send(s: Store, command: unknown) {
  return mutate(s, { operationKey: randomUUID(), command }, now).id!;
}
test("fresh initialization creates no learning presets; legacy records survive", () => {
  const s = openDatabase(":memory:");
  try {
    seed(s, now);
    seed(s, now);
    ensureOccurrences(s, "2026-10-26", "2026-11-01", now);
    assert.equal(getLearning(s).roadmaps.length, 0);
    assert.equal(
      s.sqlite
        .prepare(
          "SELECT count(*) AS n FROM activity_templates WHERE category NOT IN ('Project','Applications')",
        )
        .pluck()
        .get(),
      0,
    );
    legacySeed(s, now);
    const before = s.sqlite
      .prepare("SELECT * FROM activity_templates ORDER BY id")
      .all();
    seed(s, now);
    assert.deepEqual(
      s.sqlite.prepare("SELECT * FROM activity_templates ORDER BY id").all(),
      before,
    );
  } finally {
    s.sqlite.close();
  }
});
test("roadmaps need no category and validate, persist and edit curated colors", () => {
  const s = openDatabase(":memory:");
  try {
    seed(s, now);
    for (const color of Object.keys(roadmapColors))
      send(s, { action: "roadmapCreate", title: color, color });
    const id = send(s, { action: "roadmapCreate", title: "My subject" });
    const map = getLearning(s).roadmaps.find((m) => m.id === id)!;
    assert.equal(map.color, "purple");
    assert.equal(map.category, "Other");
    send(s, {
      action: "roadmapChange",
      id,
      version: map.version,
      operation: { kind: "edit", title: "Renamed", color: "cyan" },
    });
    assert.equal(
      getLearning(s).roadmaps.find((m) => m.id === id)!.color,
      "cyan",
    );
    assert.throws(() =>
      send(s, {
        action: "roadmapCreate",
        title: "Invalid",
        color: "url(javascript:bad)",
      }),
    );
    assert.equal(roadmapColor(undefined), roadmapColors.purple);
  } finally {
    s.sqlite.close();
  }
});
test("only roadmap schedules recur with stable identities and preserved completed history", () => {
  const s = openDatabase(":memory:");
  try {
    seed(s, now);
    const id = send(s, {
      action: "roadmapCreate",
      title: "Systems",
      color: "blue",
    });
    const change = (operation: unknown) =>
      send(s, {
        action: "roadmapChange",
        id,
        version: getLearning(s).roadmaps[0].version,
        operation,
      });
    change({ kind: "sectionAdd", title: "Memory" });
    const section = getLearning(s).roadmaps[0].sections[0].id;
    const config = {
      weekdays: [1],
      time: null,
      minutes: 90,
      paused: false,
      removed: false,
    };
    for (const sectionId of [null])
      send(s, {
        action: "studyScheduleSave",
        roadmapId: id,
        sectionId,
        config,
      });
    const read = () =>
      getDashboard(s, "2026-10-26", "2026-11-02", now).tasks.filter(
        (t) => t.studyRoadmap?.id === id,
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
    const initial = read();
    assert.equal(initial.length, 2);
    assert.equal(read().length, 2);
    assert.ok(initial.every((t) => t.studyRoadmap?.color === "blue"));
    assert.deepEqual(
      initial
        .filter((t) => t.plannedDate === "2026-10-26")
        .map((t) => t.title)
        .sort(),
      ["Systems"],
    );
    const past = initial.find((t) => t.plannedDate === "2026-10-26")!;
    s.sqlite
      .prepare("UPDATE tasks SET status='done',version=version+1 WHERE id=?")
      .run(past.id);
    change({ kind: "edit", title: "Operating Systems", color: "green" });
    const updated = read();
    assert.deepEqual(
      updated.map((t) => t.id).sort(),
      initial.map((t) => t.id).sort(),
    );
    assert.equal(updated.find((t) => t.id === past.id)!.title, past.title);
    assert.ok(
      updated
        .filter((t) => t.plannedDate === "2026-11-02")
        .every((t) => t.title.startsWith("Operating Systems")),
    );
    change({ kind: "archive", archived: true });
    assert.ok(read().some((t) => t.id === past.id));
  } finally {
    s.sqlite.close();
  }
});
