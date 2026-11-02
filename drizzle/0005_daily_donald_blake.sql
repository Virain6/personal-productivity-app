ALTER TABLE `learning_steps` ADD `description` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `learning_steps` ADD `objective` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `learning_steps` ADD `status` text DEFAULT 'not_started' NOT NULL;--> statement-breakpoint
ALTER TABLE `roadmap_sections` ADD `description` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `roadmap_sections` ADD `objective` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `roadmap_sections` ADD `resource_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `roadmaps` ADD `description` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `roadmaps` ADD `goal` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `roadmaps` ADD `target_date` text;--> statement-breakpoint
UPDATE learning_steps SET status = 'completed' WHERE completed = 1;
