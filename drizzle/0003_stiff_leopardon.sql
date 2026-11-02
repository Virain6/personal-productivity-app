CREATE TABLE `learning_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`section_id` text NOT NULL,
	`title` text NOT NULL,
	`resource_url` text DEFAULT '' NOT NULL,
	`position` integer NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`deleted` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`section_id`) REFERENCES `roadmap_sections`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `learning_step_order` ON `learning_steps` (`section_id`,`position`);--> statement-breakpoint
CREATE TABLE `roadmap_sections` (
	`id` text PRIMARY KEY NOT NULL,
	`roadmap_id` text NOT NULL,
	`title` text NOT NULL,
	`position` integer NOT NULL,
	`deleted` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`roadmap_id`) REFERENCES `roadmaps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `roadmap_section_order` ON `roadmap_sections` (`roadmap_id`,`position`);--> statement-breakpoint
CREATE TABLE `roadmaps` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`current_step_id` text,
	`created_at` integer NOT NULL
);
