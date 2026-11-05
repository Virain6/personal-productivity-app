"use client";
import { useSyncExternalStore } from "react";
import { localDate } from "@/lib/dates";
import {
  calendarDateKey,
  selectedCalendarDate,
} from "@/lib/calendar-navigation";
let memory: string | null = null;
function snapshot() {
  try {
    return selectedCalendarDate(
      sessionStorage.getItem(calendarDateKey) ?? memory,
      localDate(),
    );
  } catch {
    return selectedCalendarDate(memory, localDate());
  }
}
function subscribe(callback: () => void) {
  window.addEventListener("planner:date", callback);
  return () => window.removeEventListener("planner:date", callback);
}
export function useCalendarDate() {
  const date = useSyncExternalStore(subscribe, snapshot, localDate);
  function setDate(value: string | ((previous: string) => string)) {
    const next = typeof value === "function" ? value(snapshot()) : value;
    memory = selectedCalendarDate(next, localDate());
    try {
      sessionStorage.setItem(calendarDateKey, memory);
    } catch {}
    window.dispatchEvent(new Event("planner:date"));
  }
  return [date, setDate] as const;
}
