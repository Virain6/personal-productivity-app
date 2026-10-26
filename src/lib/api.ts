export async function loadJson<T>(
  url: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(url, { cache: "no-store", signal });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error?.message ?? "Could not load your planner.");
  return result;
}
const pendingOperations = new Map<string, string>();
export async function sendCommand(command: Record<string, unknown>) {
  const payload = JSON.stringify(command);
  const operationKey = pendingOperations.get(payload) ?? crypto.randomUUID();
  pendingOperations.set(payload, operationKey);
  const response = await fetch("/api/planner", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operationKey, command }),
  });
  const result = await response.json();
  if (!response.ok) {
    if (response.status < 500) pendingOperations.delete(payload);
    throw new Error(result.error?.message ?? "The change was not saved.");
  }
  pendingOperations.delete(payload);
  window.dispatchEvent(new Event("planner:changed"));
  return result as { ok: boolean; id?: string };
}
