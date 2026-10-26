import test from "node:test";
import assert from "node:assert/strict";
import { guardRequest } from "../src/server/services/http";
function request(host: string, origin: string) {
  return new Request("http://localhost:3124/api/planner", {
    method: "POST",
    headers: { host, origin, "Content-Type": "application/json" },
  });
}
test("accept same-origin loopback even when Next normalizes URL", () => {
  assert.doesNotThrow(() =>
    guardRequest(request("127.0.0.1:3124", "http://127.0.0.1:3124"), true),
  );
});
test("reject foreign origins, unknown hosts and mismatched ports", () => {
  assert.throws(() =>
    guardRequest(request("127.0.0.1:3124", "https://evil.example"), true),
  );
  assert.throws(() =>
    guardRequest(request("evil.example", "https://evil.example"), false),
  );
  assert.throws(() =>
    guardRequest(request("127.0.0.1:3124", "http://127.0.0.1:3000"), true),
  );
});
test("configured remote origin requires exact host and origin", () => {
  assert.doesNotThrow(() =>
    guardRequest(
      request("planner.example", "https://planner.example"),
      true,
      "https://planner.example",
    ),
  );
  assert.throws(() =>
    guardRequest(
      request("wrong.example", "https://planner.example"),
      true,
      "https://planner.example",
    ),
  );
});
