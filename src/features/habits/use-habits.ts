"use client";
import { useEffect, useState } from "react";
import { loadJson } from "@/lib/api";
import type { HabitsData, HabitCalendarData } from "@/lib/habit-types";
function useHabitQuery<T>(url: string) {
  const [loaded, setLoaded] = useState<{ url: string; value: T } | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const data = loaded?.url === url ? loaded.value : null;
  useEffect(() => {
    let active = true,
      sequence = 0;
    const controller = new AbortController();
    async function load() {
      const ticket = ++sequence;
      try {
        const value = await loadJson<T>(url, controller.signal);
        if (active && ticket === sequence) {
          setLoaded({ url, value });
          setError("");
        }
      } catch (e) {
        if (active && ticket === sequence)
          setError(e instanceof Error ? e.message : "Could not load habits.");
      }
    }
    const reload = () => void load();
    void load();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 15000);
    window.addEventListener("planner:changed", reload);
    window.addEventListener("focus", reload);
    window.addEventListener("online", reload);
    return () => {
      active = false;
      controller.abort();
      clearInterval(interval);
      window.removeEventListener("planner:changed", reload);
      window.removeEventListener("focus", reload);
      window.removeEventListener("online", reload);
    };
  }, [url, refresh]);
  return { data, error, reload: () => setRefresh((n) => n + 1) };
}

export function useHabits(date: string) {
  return useHabitQuery<HabitsData>(`/api/planner?view=habits&date=${date}`);
}
export function useHabitCalendar(from: string, to: string) {
  return useHabitQuery<HabitCalendarData>(
    `/api/planner?view=habitCalendar&from=${from}&to=${to}`,
  );
}
