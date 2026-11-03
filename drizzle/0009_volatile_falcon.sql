CREATE TABLE `weekly_reviews` (
	`week` text PRIMARY KEY NOT NULL,
	`wins` text DEFAULT '' NOT NULL,
	`challenges` text DEFAULT '' NOT NULL,
	`priorities` text DEFAULT '' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "review_monday" CHECK(strftime('%w', "weekly_reviews"."week") = '1'),
	CONSTRAINT "review_version" CHECK("weekly_reviews"."version">0)
);
