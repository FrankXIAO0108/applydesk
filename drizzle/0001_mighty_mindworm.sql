CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`company` text NOT NULL,
	`state` text NOT NULL,
	`sourceUrl` text NOT NULL,
	`checkedAt` text NOT NULL,
	`lastSuccessAt` text,
	`error` text,
	`recordCount` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sources_owner_company` ON `sources` (`owner`,`company`);--> statement-breakpoint
DROP INDEX `jobs_owner_url`;--> statement-breakpoint
ALTER TABLE `jobs` ADD `recordKey` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `applied` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_owner_record_key` ON `jobs` (`owner`,`recordKey`);