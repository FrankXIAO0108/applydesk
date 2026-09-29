CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`jobId` text,
	`message` text NOT NULL,
	`createdAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`company` text NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`location` text NOT NULL,
	`employment` text NOT NULL,
	`description` text NOT NULL,
	`direction` text NOT NULL,
	`matchState` text NOT NULL,
	`matchReason` text NOT NULL,
	`decision` text DEFAULT 'pending' NOT NULL,
	`appliedAt` text,
	`rawStatus` text,
	`stage` text,
	`checkedAt` text,
	`checkError` text,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_owner_url` ON `jobs` (`owner`,`url`);--> statement-breakpoint
CREATE TABLE `settings` (
	`owner` text PRIMARY KEY NOT NULL,
	`sheetToken` text,
	`sheetId` text,
	`sheetUrl` text,
	`syncedAt` text,
	`syncError` text,
	`syncLock` text
);
