import { DomainError } from "./validation";

// Next may normalize request.url to localhost. Validate the actual Host header,
// and use APP_ORIGIN as the single authoritative origin for remote deployments.
export function guardRequest(
  request: Request,
  write = false,
  configured = process.env.APP_ORIGIN,
) {
  const requestUrl = new URL(request.url);
  const host = request.headers.get("host");
  if (!host || /[\s/@\\]/.test(host))
    throw new DomainError("Untrusted host.", 403);
  let actual: URL;
  try {
    actual = new URL(`${requestUrl.protocol}//${host}`);
  } catch {
    throw new DomainError("Untrusted host.", 403);
  }
  const expected = configured ? new URL(configured) : actual;
  if (
    configured
      ? actual.host !== expected.host
      : !["localhost", "127.0.0.1", "[::1]"].includes(actual.hostname)
  )
    throw new DomainError("Configure APP_ORIGIN before remote access.", 403);
  if (
    write &&
    (request.headers.get("origin") !== expected.origin ||
      !request.headers.get("content-type")?.startsWith("application/json"))
  )
    throw new DomainError("Use the same-origin app to save changes.", 403);
}
