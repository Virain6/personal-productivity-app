import { guardRequest } from "@/server/services/http";
import { ZodError } from "zod";
import { getStore } from "@/server/db/runtime";
import { getDashboard, getRunning } from "@/server/services/dashboard";
import { mutate } from "@/server/services/mutations";
import { DomainError } from "@/server/services/validation";
import { addDays, localDate, weekStart } from "@/lib/dates";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function failure(error: unknown) {
  if (error instanceof ZodError)
    return Response.json(
      { error: { message: error.issues.map((i) => i.message).join(" ") } },
      { status: 400 },
    );
  if (error instanceof DomainError)
    return Response.json(
      { error: { message: error.message } },
      { status: error.status },
    );
  if (error instanceof SyntaxError)
    return Response.json(
      { error: { message: "Invalid JSON." } },
      { status: 400 },
    );
  console.error(
    "Planner operation failed",
    error instanceof Error ? error.message : "unknown",
  );
  return Response.json(
    { error: { message: "Could not save or load data. Please try again." } },
    { status: 500 },
  );
}
export async function GET(request: Request) {
  try {
    guardRequest(request);
    const url = new URL(request.url);
    const store = getStore();
    if (url.searchParams.get("view") === "timer")
      return Response.json(getRunning(store), {
        headers: { "Cache-Control": "no-store" },
      });
    const from = url.searchParams.get("from") ?? weekStart(localDate());
    const to = url.searchParams.get("to") ?? addDays(from, 6);
    return Response.json(getDashboard(store, from, to), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    guardRequest(request, true);
    const text = await request.text();
    if (text.length > 16384) throw new DomainError("Request too large.", 413);
    return Response.json(mutate(getStore(), JSON.parse(text)));
  } catch (error) {
    return failure(error);
  }
}
