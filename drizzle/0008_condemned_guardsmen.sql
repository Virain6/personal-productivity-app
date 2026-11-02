CREATE TABLE `retired_study_tasks` (
	`task_id` text PRIMARY KEY NOT NULL,
	`reason` text NOT NULL,
	`retired_at` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
