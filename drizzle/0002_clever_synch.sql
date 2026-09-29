CREATE TABLE `searches` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`company` text NOT NULL,
	`state` text NOT NULL,
	`sourceUrl` text NOT NULL,
	`checkedAt` text NOT NULL,
	`error` text,
	`itemCount` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `searches_owner_company` ON `searches` (`owner`,`company`);