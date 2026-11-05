CREATE TABLE `general_template_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`version` integer NOT NULL,
	`effective_from` text NOT NULL,
	`config` text NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `activity_templates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `general_template_version` ON `general_template_versions` (`template_id`,`version`);