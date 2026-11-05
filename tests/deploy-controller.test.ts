import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
test("deployment controller gates, safe sequencing and failure latches", () => {
  const result = spawnSync(
    "python3",
    [
      "-B",
      "-m",
      "unittest",
      "discover",
      "-s",
      "deploy",
      "-p",
      "test_*.py",
      "-v",
    ],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
