CREATE TABLE `habit_records` (
	`id` text PRIMARY KEY NOT NULL,
	`habit_id` text NOT NULL,
	`local_date` text NOT NULL,
	`revision_id` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`state` text NOT NULL,
	`quantity_milli` integer,
	`workout` text DEFAULT '' NOT NULL,
	`planned_workout` text DEFAULT '' NOT NULL,
	`advanced_from` integer,
	`advance_cursor` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`habit_id`) REFERENCES `habits`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`revision_id`) REFERENCES `habit_revisions`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "habit_quantity" CHECK("habit_records"."quantity_milli" IS NULL OR ("habit_records"."quantity_milli">=0 AND "habit_records"."quantity_milli"<=1000000000000)),
	CONSTRAINT "habit_record_state" CHECK("habit_records"."state" IN ('unlogged','done','notDone','rest'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `habit_daily_identity` ON `habit_records` (`habit_id`,`local_date`);--> statement-breakpoint
CREATE TABLE `habit_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`habit_id` text NOT NULL,
	`version` integer NOT NULL,
	`effective_date` text NOT NULL,
	`config` text NOT NULL,
	FOREIGN KEY (`habit_id`) REFERENCES `habits`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `habit_revision_version` ON `habit_revisions` (`habit_id`,`version`);--> statement-breakpoint
CREATE TABLE `habits` (
	`id` text PRIMARY KEY NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_date` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`next_index` integer DEFAULT 0 NOT NULL,
	`next_date` text,
	`cursor_version` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "habit_index" CHECK("habits"."next_index">=0)
);
