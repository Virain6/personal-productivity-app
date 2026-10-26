import { DateTime } from "luxon";
export const DEFAULT_ZONE = "America/Toronto";
export function localDate(now = Date.now(), zone = DEFAULT_ZONE) {
  return DateTime.fromMillis(now, { zone }).toISODate()!;
}
export function addDays(date: string, days: number) {
  return DateTime.fromISO(date, { zone: "UTC" }).plus({ days }).toISODate()!;
}
export function weekStart(date: string) {
  const d = DateTime.fromISO(date, { zone: "UTC" });
  return d.minus({ days: d.weekday - 1 }).toISODate()!;
}
export function dayBounds(date: string, zone = DEFAULT_ZONE) {
  const d = DateTime.fromISO(date, { zone }).startOf("day");
  return [d.toMillis(), d.plus({ days: 1 }).toMillis()] as const;
}
export function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    DateTime.fromISO(value, { zone: "UTC" }).isValid
  );
}
export function formatDuration(ms: number) {
  const minutes = Math.floor(Math.max(0, ms) / 60000);
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
    : `${minutes}m`;
}
export function clockDuration(ms: number) {
  const s = Math.floor(Math.max(0, ms) / 1000);
  return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
// Reject nonexistent local clock times rather than silently changing manual logs.
export function localOptions(value: string, zone = DEFAULT_ZONE) {
  value = value.replace(/:00$/, (suffix) =>
    value.length === 19 ? "" : suffix,
  );
  const d = DateTime.fromISO(value, { zone });
  if (!d.isValid || d.toFormat("yyyy-MM-dd'T'HH:mm") !== value) return [];
  return d
    .getPossibleOffsets()
    .map((x) => ({ value: x.toMillis(), label: x.toFormat("ZZ") }));
}
