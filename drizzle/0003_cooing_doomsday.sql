CREATE TABLE `preferences` (
	`owner` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `updateRuns` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`period` text NOT NULL,
	`triggerKind` text NOT NULL,
	`state` text NOT NULL,
	`startedAt` text NOT NULL,
	`finishedAt` text,
	`summary` text,
	`config` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `updateRuns_owner_period` ON `updateRuns` (`owner`,`period`);--> statement-breakpoint
CREATE UNIQUE INDEX `updateRuns_owner_active` ON `updateRuns` (`owner`) WHERE "updateRuns"."state" = 'running';--> statement-breakpoint
CREATE TABLE `updateScheduler` (
	`owner` text PRIMARY KEY NOT NULL,
	`automationId` text NOT NULL,
	`registeredAt` text NOT NULL
);
