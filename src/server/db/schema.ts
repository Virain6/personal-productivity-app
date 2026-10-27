import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/sqlite-core";
import { categories } from "../../lib/planner-types";
export const settings = sqliteTable(
  "settings",
  {
    id: integer("id").primaryKey(),
    timezone: text("timezone").notNull(),
    onboardingDate: text("onboarding_date").notNull(),
  },
  (t) => [check("single_settings", sql`${t.id}=1`)],
);
export const templates = sqliteTable(
  "activity_templates",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    category: text("category", { enum: categories }).notNull(),
    weekday: integer("weekday").notNull(),
    targetMinutes: integer("target_minutes").notNull(),
    suggestedTime: text("suggested_time"),
    optional: integer("optional", { mode: "boolean" }).notNull().default(false),
    effectiveFrom: text("effective_from").notNull(),
    effectiveUntil: text("effective_until"),
  },
  (t) => [
    check("template_weekday", sql`${t.weekday} BETWEEN 1 AND 7`),
    check("template_duration", sql`${t.targetMinutes}>0`),
  ],
);
export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    templateId: text("template_id").references(() => templates.id),
    occurrenceDate: text("occurrence_date"),
    plannedDate: text("planned_date").notNull(),
    title: text("title").notNull(),
    category: text("category", { enum: categories }).notNull(),
    mode: text("mode", { enum: ["flexible", "fixed"] })
      .notNull()
      .default("flexible"),
    suggestedTime: text("suggested_time"),
    targetMinutes: integer("target_minutes").notNull(),
    fixedStart: integer("fixed_start"),
    fixedEnd: integer("fixed_end"),
    optional: integer("optional", { mode: "boolean" }).notNull().default(false),
    status: text("status", {
      enum: ["pending", "in_progress", "done", "skipped"],
    })
      .notNull()
      .default("pending"),
    summary: text("summary").notNull().default(""),
    version: integer("version").notNull().default(1),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("occurrence_identity").on(t.templateId, t.occurrenceDate),
    index("task_day").on(t.plannedDate),
    check("task_duration", sql`${t.targetMinutes}>0`),
    check(
      "task_status",
      sql`${t.status} IN ('pending','in_progress','done','skipped')`,
    ),
    check("task_summary", sql`length(${t.summary})<=500`),
    check(
      "task_origin",
      sql`(${t.templateId} IS NULL AND ${t.occurrenceDate} IS NULL) OR (${t.templateId} IS NOT NULL AND ${t.occurrenceDate} IS NOT NULL)`,
    ),
    check(
      "fixed_interval",
      sql`(${t.mode}='flexible' AND ${t.fixedStart} IS NULL AND ${t.fixedEnd} IS NULL) OR (${t.mode}='fixed' AND ${t.fixedStart} IS NOT NULL AND ${t.fixedEnd}>${t.fixedStart})`,
    ),
  ],
);
export const sessions = sqliteTable(
  "time_sessions",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id),
    startedAt: integer("started_at").notNull(),
    endedAt: integer("ended_at"),
    source: text("source", { enum: ["timer", "manual"] }).notNull(),
    overlapConfirmed: integer("overlap_confirmed", { mode: "boolean" })
      .notNull()
      .default(false),
    summary: text("summary").notNull().default(""),
  },
  (t) => [
    uniqueIndex("single_running_timer")
      .on(sql`(1)`)
      .where(sql`${t.endedAt} IS NULL`),
    index("session_task").on(t.taskId),
    check(
      "session_interval",
      sql`${t.endedAt} IS NULL OR ${t.endedAt}>${t.startedAt}`,
    ),
    check(
      "manual_closed",
      sql`${t.source}='timer' OR (${t.source}='manual' AND ${t.endedAt} IS NOT NULL)`,
    ),
    check("session_summary", sql`length(${t.summary})<=500`),
  ],
);
export const completions = sqliteTable(
  "activity_completions",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id),
    completedAt: integer("completed_at").notNull(),
    undoneAt: integer("undone_at"),
  },
  (t) => [
    uniqueIndex("one_completion")
      .on(t.taskId)
      .where(sql`${t.undoneAt} IS NULL`),
  ],
);
export const receipts = sqliteTable("mutation_receipts", {
  key: text("key").primaryKey(),
  payload: text("payload").notNull(),
  result: text("result").notNull(),
  createdAt: integer("created_at").notNull(),
});

// Habits are independent of study tasks/timers. Immutable revisions preserve old units/types/targets.
export const habits = sqliteTable(
  "habits",
  {
    id: text("id").primaryKey(),
    version: integer("version").notNull().default(1),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdDate: text("created_date").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    nextIndex: integer("next_index").notNull().default(0),
    nextDate: text("next_date"),
    cursorVersion: integer("cursor_version").notNull().default(0),
  },
  (t) => [check("habit_index", sql`${t.nextIndex}>=0`)],
);
export const habitRevisions = sqliteTable(
  "habit_revisions",
  {
    id: text("id").primaryKey(),
    habitId: text("habit_id")
      .notNull()
      .references(() => habits.id),
    version: integer("version").notNull(),
    effectiveDate: text("effective_date").notNull(),
    config: text("config", { mode: "json" })
      .$type<import("../../lib/habit-types").HabitConfig>()
      .notNull(),
  },
  (t) => [uniqueIndex("habit_revision_version").on(t.habitId, t.version)],
);
export const habitRecords = sqliteTable(
  "habit_records",
  {
    id: text("id").primaryKey(),
    habitId: text("habit_id")
      .notNull()
      .references(() => habits.id),
    date: text("local_date").notNull(),
    revisionId: text("revision_id")
      .notNull()
      .references(() => habitRevisions.id),
    version: integer("version").notNull().default(1),
    state: text("state", {
      enum: ["unlogged", "done", "notDone", "rest"],
    }).notNull(),
    quantityMilli: integer("quantity_milli"),
    workout: text("workout").notNull().default(""),
    plannedWorkout: text("planned_workout").notNull().default(""),
    advancedFrom: integer("advanced_from"),
    advanceCursor: integer("advance_cursor"),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("habit_daily_identity").on(t.habitId, t.date),
    check(
      "habit_quantity",
      sql`${t.quantityMilli} IS NULL OR (${t.quantityMilli}>=0 AND ${t.quantityMilli}<=1000000000000)`,
    ),
    check(
      "habit_record_state",
      sql`${t.state} IN ('unlogged','done','notDone','rest')`,
    ),
  ],
);
