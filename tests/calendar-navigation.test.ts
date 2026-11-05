import test from "node:test";
import assert from "node:assert/strict";
import {
  beginSwipe,
  trackSwipe,
  finishSwipe,
  selectedCalendarDate,
} from "../src/lib/calendar-navigation";
import { addDays, localDate } from "../src/lib/dates";
import { monthGrid, moveCalendar } from "../src/lib/month-calendar";

test("short horizontal gestures navigate one day in either direction", () => {
  const s = beginSwipe(200, 100, 10, 1, false);
  assert.equal(finishSwipe(s, 100, 110, 250), 1);
  assert.equal(finishSwipe(s, 300, 110, 250), -1);
  assert.equal(finishSwipe(s, 160, 100, 250), 0);
  assert.equal(finishSwipe(s, 100, 180, 250), 0);
});
test("vertical scrolling locks out navigation even if the gesture later moves sideways", () => {
  const s = trackSwipe(beginSwipe(200, 100, 10, 1, false), 202, 150, 1);
  assert.equal(finishSwipe(s, 50, 150, 250), 0);
  assert.equal(finishSwipe(trackSwipe(s, 50, 150, 1), 40, 150, 300), 0);
});
test("controls, multi-touch, long holds and cancelled gestures never navigate", () => {
  assert.equal(beginSwipe(200, 100, 0, 1, true), null);
  assert.equal(beginSwipe(200, 100, 0, 2, false), null);
  const s = beginSwipe(200, 100, 0, 1, false);
  assert.equal(finishSwipe(trackSwipe(s, 100, 100, 2), 90, 100, 200), 0);
  assert.equal(finishSwipe(s, 100, 100, 801), 0);
  assert.equal(finishSwipe(s, 100, 100, -1), 0);
  assert.equal(finishSwipe(null, 100, 100, 200), 0);
});
test("selected dates recover safely across routes and reject corrupt stored values", () => {
  const today = "2026-11-04";
  assert.equal(selectedCalendarDate("2026-12-31", today), "2026-12-31");
  assert.equal(selectedCalendarDate("2024-02-29", today), "2024-02-29");
  for (const raw of [
    null,
    "",
    "garbage",
    "2026-02-29",
    "2026-11-04T01:00:00Z",
    "2026-1-1",
  ])
    assert.equal(selectedCalendarDate(raw, today), today);
});
test("mobile picker and day navigation reuse Monday grids across year and Toronto DST boundaries", () => {
  const day = "2026-12-31";
  assert.ok(monthGrid(day).days.includes("2027-01-01"));
  assert.equal(moveCalendar(day, "day", 1), "2027-01-01");
  for (const day of ["2026-03-08", "2026-11-01"]) {
    assert.equal(moveCalendar(day, "day", 1), addDays(day, 1));
    assert.ok(monthGrid(day).days.includes(day));
  }
  assert.equal(localDate(Date.parse("2026-11-05T02:00:00Z")), "2026-11-04");
});
