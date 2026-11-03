import type { ActivityCell, HabitAnalytics } from "./activity-analytics";
export type AnalyticsRange = { from: string; to: string };
export type AnalyticsDay = {
  date: string;
  studyMs: number;
  trackedMs: number;
  plannedMs: number;
  studySessions: number;
};
export type AnalyticsModule = {
  id: string;
  title: string;
  archived: boolean;
  studyMs: number;
  steps: number;
  completed: number;
};
export type AnalyticsRoadmap = {
  id: string;
  title: string;
  color: string;
  archived: boolean;
  studyMs: number;
  sessions: number;
  lastStudied: string | null;
  modules: AnalyticsModule[];
  activity: ActivityCell[];
  dailyTime: { date: string; studyMs: number }[];
  eligibleDays: number;
  studiedScheduledDays: number;
  consistency: number | null;
  mastery: { completed: number; steps: number };
};
export type AnalyticsData = {
  range: AnalyticsRange;
  today: string;
  timezone: string;
  days: AnalyticsDay[];
  trend: { date: string; studyMs: number }[];
  roadmaps: AnalyticsRoadmap[];
  habits: HabitAnalytics[];
  summary: {
    studyMs: number;
    trackedMs: number;
    plannedMs: number;
    studySessions: number;
    completedTasks: number;
    requiredTasks: number;
    completedRequired: number;
    completionRate: number | null;
    studyTasks: {
      completed: number;
      skipped: number;
      missed: number;
      open: number;
      upcoming: number;
    };
  };
  previous:
    | (AnalyticsRange & {
        studyMs: number;
        trackedMs: number;
        hasStudy: boolean;
      })
    | null;
};
