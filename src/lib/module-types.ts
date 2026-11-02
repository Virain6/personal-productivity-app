export type StudyScheduleConfig = {
  weekdays: number[];
  time: string | null;
  minutes: number;
  paused: boolean;
  removed: boolean;
};
export type StudySchedule = {
  id: string;
  roadmapId: string;
  sectionId: string | null;
  version: number;
  createdDate: string;
  config: StudyScheduleConfig;
};
export type ModuleDay = {
  date: string;
  studiedMs: number;
  sessionCount: number;
  scheduled: number;
  completed: number;
  state: "future" | "missed" | "completed" | "today" | "unscheduled" | "rest";
};
export type ModuleData = {
  today: string;
  timezone: string;
  month: string;
  schedules: StudySchedule[];
  templates: {
    id: string;
    title: string;
    weekday: number;
    targetMinutes: number;
    suggestedTime: string | null;
  }[];
  days: ModuleDay[];
  totals: { studiedMs: number; sessions: number; lastStudied: string | null };
  monthStats: {
    studiedMs: number;
    sessions: number;
    completed: number;
    eligibleDays: number;
    successfulDays: number;
    consistency: number | null;
  };
  history: {
    id: string;
    startedAt: number;
    endedAt: number | null;
    title: string;
    summary: string;
  }[];
  occurrences: {
    id: string;
    title: string;
    plannedDate: string;
    status: string;
    cancelled: boolean;
    sectionId: string | null;
    scheduleId: string | null;
  }[];
};
