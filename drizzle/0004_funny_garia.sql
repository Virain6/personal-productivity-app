CREATE TABLE `session_learning` (
	`session_id` text PRIMARY KEY NOT NULL,
	`step_id` text,
	`roadmap_id` text,
	`roadmap_title` text DEFAULT '' NOT NULL,
	`section_title` text DEFAULT '' NOT NULL,
	`step_title` text DEFAULT '' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `time_sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`step_id`) REFERENCES `learning_steps`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`roadmap_id`) REFERENCES `roadmaps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `session_learning_step` ON `session_learning` (`step_id`);--> statement-breakpoint
CREATE TABLE `task_learning` (
	`task_id` text PRIMARY KEY NOT NULL,
	`step_id` text,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`step_id`) REFERENCES `learning_steps`(`id`) ON UPDATE no action ON DELETE no action
);
