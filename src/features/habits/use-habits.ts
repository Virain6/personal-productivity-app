"use client";
import { usePlannerQuery } from "@/lib/use-planner-query";
import type { HabitsData, HabitCalendarData } from "@/lib/habit-types";

export function useHabits(date: string) {
  return usePlannerQuery<HabitsData>(`/api/planner?view=habits&date=${date}`);
}
export function useHabitCalendar(from: string, to: string) {
  return usePlannerQuery<HabitCalendarData>(
    `/api/planner?view=habitCalendar&from=${from}&to=${to}`,
  );
}
