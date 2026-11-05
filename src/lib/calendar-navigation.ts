import { validDate } from "./dates";

// UI preference only; all activities and dates on records remain server-owned.
export const calendarDateKey = "planner.date.v1";
export function selectedCalendarDate(saved: string | null, today: string) {
  return saved && validDate(saved) ? saved : today;
}
export type Swipe = { x: number; y: number; at: number; cancelled: boolean };
export function beginSwipe(
  x: number,
  y: number,
  at: number,
  touches: number,
  interactive: boolean,
): Swipe | null {
  return touches === 1 && !interactive ? { x, y, at, cancelled: false } : null;
}
export function trackSwipe(
  s: Swipe | null,
  x: number,
  y: number,
  touches: number,
): Swipe | null {
  if (!s) return null;
  const dx = Math.abs(x - s.x),
    dy = Math.abs(y - s.y);
  // Once vertical intent or multi-touch is detected, never reinterpret as navigation.
  return {
    ...s,
    cancelled: s.cancelled || touches !== 1 || (dy > 12 && dy >= dx),
  };
}
export function finishSwipe(
  s: Swipe | null,
  x: number,
  y: number,
  at: number,
): -1 | 0 | 1 {
  if (!s || s.cancelled || at - s.at > 800 || at < s.at) return 0;
  const dx = x - s.x,
    dy = y - s.y;
  return Math.abs(dx) >= 65 && Math.abs(dx) > Math.abs(dy) * 1.5
    ? dx < 0
      ? 1
      : -1
    : 0;
}
export const swipeControlSelector =
  "button,a,input,select,textarea,label,summary,[role='button'],[contenteditable],[data-no-swipe]";
