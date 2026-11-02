// Explicit maintenance only; never imported or invoked by app startup.
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../src/server/db/schema";
import { openDatabase } from "../src/server/db/connection";
import {
  retirementPlan,
  retireLearning,
} from "../src/server/services/retire-learning";
const path = process.env.DATABASE_PATH;
if (!path)
  throw new Error("Set DATABASE_PATH explicitly to the reviewed database.");
if (process.argv.includes("--apply")) {
  execFileSync(
    process.execPath,
    ["scripts/deploy-db.mjs", "backup", resolve("backups")],
    { stdio: "inherit", env: { ...process.env, DATABASE_PATH: resolve(path) } },
  );
  const store = openDatabase(path);
  try {
    console.log(JSON.stringify(retireLearning(store), null, 2));
    if (
      store.sqlite.pragma("integrity_check", { simple: true }) !== "ok" ||
      (store.sqlite.pragma("foreign_key_check") as unknown[]).length
    )
      throw new Error("Database verification failed. Retain the backup.");
  } finally {
    store.sqlite.close();
  }
} else {
  const sqlite = new Database(path, { readonly: true, fileMustExist: true });
  try {
    console.log(
      JSON.stringify(
        retirementPlan({ sqlite, db: drizzle(sqlite, { schema }) }),
        null,
        2,
      ),
    );
  } finally {
    sqlite.close();
  }
}
