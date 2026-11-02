CREATE TABLE `study_schedule_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`schedule_id` text NOT NULL,
	`version` integer NOT NULL,
	`effective_from` text NOT NULL,
	`config` text NOT NULL,
	FOREIGN KEY (`schedule_id`) REFERENCES `study_schedules`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `study_schedule_version` ON `study_schedule_versions` (`schedule_id`,`version`);--> statement-breakpoint
CREATE TABLE `study_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`roadmap_id` text NOT NULL,
	`section_id` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_date` text NOT NULL,
	FOREIGN KEY (`roadmap_id`) REFERENCES `roadmaps`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`section_id`) REFERENCES `roadmap_sections`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `study_template_links` (
	`template_id` text PRIMARY KEY NOT NULL,
	`schedule_id` text NOT NULL,
	`weekday` integer NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `activity_templates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`schedule_id`) REFERENCES `study_schedules`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `study_schedule_weekday` ON `study_template_links` (`schedule_id`,`weekday`);--> statement-breakpoint
CREATE TABLE `task_study` (
	`task_id` text PRIMARY KEY NOT NULL,
	`schedule_id` text,
	`roadmap_id` text NOT NULL,
	`section_id` text,
	`cancelled` integer DEFAULT false NOT NULL,
	`managed_version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`schedule_id`) REFERENCES `study_schedules`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`roadmap_id`) REFERENCES `roadmaps`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`section_id`) REFERENCES `roadmap_sections`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `roadmap_sections` ADD `archived` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `session_learning` ADD `section_id` text REFERENCES roadmap_sections(id);
--> statement-breakpoint
UPDATE session_learning SET section_id = (SELECT section_id FROM learning_steps WHERE learning_steps.id = session_learning.step_id) WHERE step_id IS NOT NULL;
