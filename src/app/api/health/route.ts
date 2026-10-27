import Database from "better-sqlite3";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  let db: Database.Database | undefined;
  try {
    db = new Database(process.env.DATABASE_PATH ?? "./data/planner.db", {
      readonly: true,
      fileMustExist: true,
    });
    db.prepare("SELECT id FROM __drizzle_migrations LIMIT 1").get();
    db.prepare("SELECT id FROM habit_records LIMIT 1").get();
    return Response.json(
      { status: "ok" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  } finally {
    db?.close();
  }
}
