export const categories = [
  "DSA",
  "Fundamentals",
  "Databases",
  "Interviews",
  "System/Backend",
  "Testing/DevOps",
  "Specialization",
  "Project",
  "Applications",
  "Other",
] as const;
export type Category = (typeof categories)[number];
export type TaskStatus = "pending" | "in_progress" | "done" | "skipped";
export type Task = {
  id: string;
  templateId: string | null;
  occurrenceDate: string | null;
  plannedDate: string;
  title: string;
  category: Category;
  mode: "flexible" | "fixed";
  suggestedTime: string | null;
  targetMinutes: number;
  fixedStart: number | null;
  fixedEnd: number | null;
  optional: boolean;
  status: TaskStatus;
  summary: string;
  version: number;
  createdAt: number;
  updatedAt: number;
  actualMs: number;
};
export type Session = {
  id: string;
  taskId: string;
  startedAt: number;
  endedAt: number | null;
  source: "timer" | "manual";
  overlapConfirmed: boolean;
  summary: string;
};
export type HomeData = {
  tasks: Task[];
  running: (Session & { title: string }) | null;
  sessions: Session[];
  serverNow: number;
  today: string;
  timezone: string;
  metrics: {
    completed: number;
    skipped: number;
    optionalCompleted: number;
    overlapConfirmed: boolean;
    required: number;
    requiredDone: number;
    plannedMinutes: number;
    trackedMs: number;
    days: {
      date: string;
      trackedMs: number;
      plannedMinutes: number;
      skipped: number;
      done: number;
      required: number;
    }[];
  };
};
