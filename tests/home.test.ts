import test from "node:test";
import assert from "node:assert/strict";
import { compareAgenda, completionLabel } from "../src/lib/home";
import type { Task } from "../src/lib/planner-types";
test("agenda orders fixed and suggested times before anytime and completed tasks", () => {
  const base = {
    category: "Other",
    status: "pending",
    mode: "flexible",
    suggestedTime: null,
  } as Task;
  const list = [
    { ...base, id: "any" },
    { ...base, id: "suggested", suggestedTime: "10:00" },
    {
      ...base,
      id: "fixed",
      mode: "fixed",
      fixedStart: Date.parse("2026-10-26T13:00:00Z"),
    },
    { ...base, id: "done", status: "done", suggestedTime: "08:00" },
  ] as Task[];
  assert.deepEqual(
    list
      .sort((a, b) => compareAgenda(a, b, "America/Toronto"))
      .map((t) => t.id),
    ["fixed", "suggested", "any", "done"],
  );
  assert.equal(completionLabel(0, 0), "No required activities");
  assert.equal(completionLabel(1, 3), "1/3 required · 33%");
});
