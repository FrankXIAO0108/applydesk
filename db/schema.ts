// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
import {sql} from 'drizzle-orm';
export const preferences=sqliteTable('preferences',{owner:text('owner').primaryKey(),value:text('value').notNull(),updatedAt:text('updatedAt').notNull()});
export const updateScheduler=sqliteTable('updateScheduler',{owner:text('owner').primaryKey(),automationId:text('automationId').notNull(),registeredAt:text('registeredAt').notNull()});
export const updateRuns=sqliteTable('updateRuns',{id:text('id').primaryKey(),owner:text('owner').notNull(),period:text('period').notNull(),triggerKind:text('triggerKind').notNull(),state:text('state').notNull(),startedAt:text('startedAt').notNull(),finishedAt:text('finishedAt'),summary:text('summary'),config:text('config').notNull()},t=>[uniqueIndex('updateRuns_owner_period').on(t.owner,t.period),uniqueIndex('updateRuns_owner_active').on(t.owner).where(sql`${t.state} = 'running'`)]);
export const jobs = sqliteTable('jobs', {
 id:text('id').primaryKey(), owner:text('owner').notNull(), recordKey:text('recordKey'), applied:integer('applied').notNull().default(0), company:text('company').notNull(), title:text('title').notNull(),
 url:text('url').notNull(), location:text('location').notNull(), employment:text('employment').notNull(), description:text('description').notNull(),
 direction:text('direction').notNull(), matchState:text('matchState').notNull(), matchReason:text('matchReason').notNull(), decision:text('decision').notNull().default('pending'),
 appliedAt:text('appliedAt'), rawStatus:text('rawStatus'), stage:text('stage'), checkedAt:text('checkedAt'), checkError:text('checkError'),
 createdAt:text('createdAt').notNull(), updatedAt:text('updatedAt').notNull(),
}, t=>[uniqueIndex('jobs_owner_record_key').on(t.owner,t.recordKey)]);
export const events=sqliteTable('events',{id:text('id').primaryKey(),owner:text('owner').notNull(),jobId:text('jobId'),message:text('message').notNull(),createdAt:text('createdAt').notNull()});
export const settings=sqliteTable('settings',{owner:text('owner').primaryKey(),sheetToken:text('sheetToken'),sheetId:text('sheetId'),sheetUrl:text('sheetUrl'),syncedAt:text('syncedAt'),syncError:text('syncError'),syncLock:text('syncLock')});
export const sources=sqliteTable('sources',{id:text('id').primaryKey(),owner:text('owner').notNull(),company:text('company').notNull(),state:text('state').notNull(),sourceUrl:text('sourceUrl').notNull(),checkedAt:text('checkedAt').notNull(),lastSuccessAt:text('lastSuccessAt'),error:text('error'),recordCount:integer('recordCount').notNull().default(0)},t=>[uniqueIndex('sources_owner_company').on(t.owner,t.company)]);
export const searches=sqliteTable('searches',{id:text('id').primaryKey(),owner:text('owner').notNull(),company:text('company').notNull(),state:text('state').notNull(),sourceUrl:text('sourceUrl').notNull(),checkedAt:text('checkedAt').notNull(),error:text('error'),itemCount:integer('itemCount').notNull().default(0)},t=>[uniqueIndex('searches_owner_company').on(t.owner,t.company)]);
