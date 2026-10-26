CREATE TABLE `activity_completions` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`completed_at` integer NOT NULL,
	`undone_at` integer,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_completion` ON `activity_completions` (`task_id`) WHERE "activity_completions"."undone_at" IS NULL;--> statement-breakpoint
CREATE TABLE `mutation_receipts` (
	`key` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`result` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `time_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`source` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "session_interval" CHECK("time_sessions"."ended_at" IS NULL OR "time_sessions"."ended_at">"time_sessions"."started_at"),
	CONSTRAINT "manual_closed" CHECK("time_sessions"."source"='timer' OR ("time_sessions"."source"='manual' AND "time_sessions"."ended_at" IS NOT NULL)),
	CONSTRAINT "session_summary" CHECK(length("time_sessions"."summary")<=500)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `single_running_timer` ON `time_sessions` ((1)) WHERE "time_sessions"."ended_at" IS NULL;--> statement-breakpoint
CREATE INDEX `session_task` ON `time_sessions` (`task_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`timezone` text NOT NULL,
	`onboarding_date` text NOT NULL,
	CONSTRAINT "single_settings" CHECK("settings"."id"=1)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text,
	`occurrence_date` text,
	`planned_date` text NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`mode` text DEFAULT 'flexible' NOT NULL,
	`suggested_time` text,
	`target_minutes` integer NOT NULL,
	`fixed_start` integer,
	`fixed_end` integer,
	`optional` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `activity_templates`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "task_duration" CHECK("tasks"."target_minutes">0),
	CONSTRAINT "task_status" CHECK("tasks"."status" IN ('pending','in_progress','done','skipped')),
	CONSTRAINT "task_summary" CHECK(length("tasks"."summary")<=500),
	CONSTRAINT "task_origin" CHECK(("tasks"."template_id" IS NULL AND "tasks"."occurrence_date" IS NULL) OR ("tasks"."template_id" IS NOT NULL AND "tasks"."occurrence_date" IS NOT NULL)),
	CONSTRAINT "fixed_interval" CHECK(("tasks"."mode"='flexible' AND "tasks"."fixed_start" IS NULL AND "tasks"."fixed_end" IS NULL) OR ("tasks"."mode"='fixed' AND "tasks"."fixed_start" IS NOT NULL AND "tasks"."fixed_end">"tasks"."fixed_start"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `occurrence_identity` ON `tasks` (`template_id`,`occurrence_date`);--> statement-breakpoint
CREATE INDEX `task_day` ON `tasks` (`planned_date`);--> statement-breakpoint
CREATE TABLE `activity_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`weekday` integer NOT NULL,
	`target_minutes` integer NOT NULL,
	`suggested_time` text,
	`optional` integer DEFAULT false NOT NULL,
	`effective_from` text NOT NULL,
	`effective_until` text,
	CONSTRAINT "template_weekday" CHECK("activity_templates"."weekday" BETWEEN 1 AND 7),
	CONSTRAINT "template_duration" CHECK("activity_templates"."target_minutes">0)
);
