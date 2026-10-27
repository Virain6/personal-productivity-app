// Standalone operational tool: no application seeds or destructive overwrite.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
process.umask(0o077);
function verify(db) {
  if (db.pragma("integrity_check", { simple: true }) !== "ok")
    throw new Error("SQLite integrity check failed");
  if (db.pragma("foreign_key_check").length)
    throw new Error("SQLite foreign key check failed");
}
async function main(args = process.argv.slice(2)) {
  const [action, argument] = args;
  const database = path.resolve(
    process.env.DATABASE_PATH || "./data/planner.db",
  );
  if (action === "migrate") {
    if (fs.existsSync(database) && fs.statSync(database).size > 0) {
      const existing = new Database(database, {
        readonly: true,
        fileMustExist: true,
      });
      let latest = 0;
      try {
        verify(existing);
        const hasJournal = existing
          .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'",
          )
          .get();
        if (hasJournal)
          latest = Number(
            existing
              .prepare(
                "SELECT max(created_at) AS latest FROM __drizzle_migrations",
              )
              .get().latest ?? 0,
          );
      } finally {
        existing.close();
      }
      const journal = JSON.parse(
        fs.readFileSync(path.resolve("drizzle/meta/_journal.json"), "utf8"),
      );
      if (journal.entries.some((entry) => entry.when > latest)) {
        console.log("Pending migrations: creating a verified backup first.");
        await main([
          "backup",
          process.env.BACKUP_DIRECTORY ||
            path.resolve(path.dirname(database), "../backups"),
        ]);
      }
    }
    fs.mkdirSync(path.dirname(database), { recursive: true });
    const db = new Database(database);
    try {
      db.pragma("busy_timeout = 5000");
      db.pragma("foreign_keys = ON");
      db.pragma("journal_mode = WAL");
      migrate(drizzle(db), { migrationsFolder: path.resolve("drizzle") });
      verify(db);
    } finally {
      db.close();
    }
    console.log("Planner migrations and integrity checks complete.");
    return;
  }
  if (action === "verify") {
    if (!argument) throw new Error("Snapshot path required");
    const snapshot = path.resolve(argument);
    const metadata = JSON.parse(
      fs.readFileSync(
        path.join(path.dirname(snapshot), "metadata.json"),
        "utf8",
      ),
    );
    const checksum = crypto
      .createHash("sha256")
      .update(fs.readFileSync(snapshot))
      .digest("hex");
    if (checksum !== metadata.sha256)
      throw new Error("Backup checksum mismatch");
    const check = new Database(snapshot, {
      readonly: true,
      fileMustExist: true,
    });
    try {
      verify(check);
    } finally {
      check.close();
    }
    console.log("Backup checksum, integrity and foreign keys verified.");
    return;
  }
  if (action !== "backup" && action !== "restore")
    throw new Error(
      "Usage: node scripts/deploy-db.mjs migrate | backup DIRECTORY | verify SNAPSHOT | restore SNAPSHOT",
    );
  if (!argument)
    throw new Error("Backup directory or restore snapshot is required");
  if (
    action === "restore" &&
    [database, database + "-wal", database + "-shm"].some(fs.existsSync)
  )
    throw new Error(
      "Restore requires a new empty database destination. Stop Planner and use a new data directory.",
    );
  const source = action === "backup" ? database : path.resolve(argument);
  if (action === "restore") await main(["verify", source]);
  const db = new Database(source, { readonly: true, fileMustExist: true });
  let folder;
  try {
    verify(db);
    const root =
      action === "backup" ? path.resolve(argument) : path.dirname(database);
    fs.mkdirSync(root, { recursive: true });
    folder = fs.mkdtempSync(
      path.join(
        root,
        action + "-" + new Date().toISOString().replace(/[:.]/g, "-") + "-",
      ),
    );
    const snapshot = path.join(folder, "planner.db");
    await db.backup(snapshot);
    const check = new Database(snapshot, { readonly: true });
    let migrations;
    try {
      verify(check);
      migrations = check
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'",
        )
        .get()
        ? check.prepare("SELECT * FROM __drizzle_migrations ORDER BY id").all()
        : [];
    } finally {
      check.close();
    }
    if (action === "backup") {
      const sha256 = crypto
        .createHash("sha256")
        .update(fs.readFileSync(snapshot))
        .digest("hex");
      fs.writeFileSync(
        path.join(folder, "metadata.json"),
        JSON.stringify(
          { createdAt: new Date().toISOString(), sha256, migrations },
          null,
          2,
        ) + "\n",
      );
      console.log(snapshot);
    } else {
      // Exclusive creation prevents replacing a database created during this operation.
      fs.linkSync(snapshot, database);
      fs.rmSync(folder, { recursive: true });
      console.log("Restored verified snapshot to " + database);
    }
  } finally {
    db.close();
  }
}
main().catch((error) => {
  console.error("Planner database operation failed:", error.message);
  process.exitCode = 1;
});
