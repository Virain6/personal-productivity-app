import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import Database from "better-sqlite3";
import { GET } from "../src/app/api/health/route";
const script = resolve("scripts/deploy-db.mjs");
function run(database: string, ...args: string[]) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    env: { ...process.env, DATABASE_PATH: database },
  });
}
test("deployment migration, live WAL backup and isolated restore preserve data without seeding or overwriting", () => {
  const root = mkdtempSync(join(tmpdir(), "planner-deploy-"));
  const source = join(root, "source.db");
  let db: Database.Database | undefined;
  try {
    assert.equal(run(source, "migrate").status, 0);
    db = new Database(source);
    assert.equal(
      db.prepare("SELECT count(*) AS n FROM activity_templates").get() &&
        (
          db.prepare("SELECT count(*) AS n FROM activity_templates").get() as {
            n: number;
          }
        ).n,
      0,
    );
    db.pragma("journal_mode = WAL");
    db.exec(
      "CREATE TABLE deployment_probe (value TEXT); INSERT INTO deployment_probe VALUES ('persisted in WAL')",
    );
    assert.equal(run(source, "migrate").status, 0);
    const backup = run(source, "backup", join(root, "backups"));
    assert.equal(backup.status, 0, backup.stderr);
    const snapshot = backup.stdout.trim();
    assert.ok(existsSync(snapshot));
    const metadata = JSON.parse(
      readFileSync(join(snapshot, "..", "metadata.json"), "utf8"),
    );
    assert.ok(metadata.migrations.length);
    assert.equal(metadata.sha256.length, 64);
    db.exec("UPDATE deployment_probe SET value='newer data'");
    const restored = join(root, "restored", "planner.db");
    assert.equal(run(restored, "restore", snapshot).status, 0);
    const check = new Database(restored);
    assert.equal(
      (
        check.prepare("SELECT value FROM deployment_probe").get() as {
          value: string;
        }
      ).value,
      "persisted in WAL",
    );
    check.close();
    assert.notEqual(run(restored, "restore", snapshot).status, 0);
    assert.equal(
      (
        db.prepare("SELECT value FROM deployment_probe").get() as {
          value: string;
        }
      ).value,
      "newer data",
    );
    assert.notEqual(
      run(join(root, "missing.db"), "backup", join(root, "backups")).status,
      0,
    );
    const corrupt = join(root, "corrupt.db");
    writeFileSync(corrupt, "not a database");
    const destination = join(root, "never-created.db");
    assert.notEqual(run(destination, "restore", corrupt).status, 0);
    assert.equal(existsSync(destination), false);
  } finally {
    db?.close();
    rmSync(root, { recursive: true, force: true });
  }
});
test("health reports missing database without creating it, then reports migrated readiness", async () => {
  const root = mkdtempSync(join(tmpdir(), "planner-health-"));
  const previous = process.env.DATABASE_PATH;
  process.env.DATABASE_PATH = join(root, "health.db");
  try {
    assert.equal((await GET()).status, 503);
    assert.equal(existsSync(process.env.DATABASE_PATH), false);
    assert.equal(run(process.env.DATABASE_PATH, "migrate").status, 0);
    assert.equal((await GET()).status, 200);
  } finally {
    if (previous === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = previous;
    rmSync(root, { recursive: true, force: true });
  }
});

test("pending migrations require a verified snapshot and fail closed if backup cannot be written", () => {
  const root = mkdtempSync(join(tmpdir(), "planner-migrate-backup-"));
  const source = join(root, "planner.db");
  const backups = join(root, "backups");
  const initial = new Database(source);
  initial.exec(
    "CREATE TABLE retained (value TEXT); INSERT INTO retained VALUES ('before migration')",
  );
  initial.close();
  const migrate = () =>
    spawnSync(process.execPath, [script, "migrate"], {
      encoding: "utf8",
      env: { ...process.env, DATABASE_PATH: source, BACKUP_DIRECTORY: backups },
    });
  try {
    writeFileSync(backups, "blocks directory creation");
    assert.notEqual(migrate().status, 0);
    const unchanged = new Database(source);
    assert.equal(
      unchanged
        .prepare(
          "SELECT name FROM sqlite_master WHERE name='__drizzle_migrations'",
        )
        .get(),
      undefined,
    );
    unchanged.close();
    rmSync(backups);
    const result = migrate();
    assert.equal(result.status, 0, result.stderr);
    const snapshot = result.stdout
      .split("\n")
      .find((line) => line.endsWith("planner.db"))!;
    assert.ok(snapshot);
    assert.equal(run(source, "verify", snapshot).status, 0);
    const before = new Database(snapshot, { readonly: true });
    assert.equal(
      before
        .prepare(
          "SELECT name FROM sqlite_master WHERE name='__drizzle_migrations'",
        )
        .get(),
      undefined,
    );
    assert.equal(
      (before.prepare("SELECT value FROM retained").get() as { value: string })
        .value,
      "before migration",
    );
    before.close();
    assert.doesNotMatch(migrate().stdout, /Pending migrations/);
    const metadataFile = join(snapshot, "..", "metadata.json");
    const metadata = JSON.parse(readFileSync(metadataFile, "utf8"));
    metadata.sha256 = "bad checksum";
    writeFileSync(metadataFile, JSON.stringify(metadata));
    assert.notEqual(run(source, "verify", snapshot).status, 0);
    const destination = join(root, "restore.db");
    assert.notEqual(run(destination, "restore", snapshot).status, 0);
    assert.equal(existsSync(destination), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
