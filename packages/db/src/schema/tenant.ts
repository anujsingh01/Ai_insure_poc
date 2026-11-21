import { sql } from 'drizzle-orm';
import { bigint, bigserial, customType, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { organization } from './auth.js';

const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' });

/**
 * Every table in this file is tenant data. Each has `org_id`, and migration 0001 enables
 * and FORCES row-level security on it, so a query only ever sees the current tenant's rows.
 * Add new tenant tables here AND to the RLS migration.
 */

export const orgProfile = pgTable('org_profile', {
  orgId: text()
    .primaryKey()
    .references(() => organization.id, { onDelete: 'cascade' }),
  industry: text().notNull().default('other'),
  languages: text()
    .array()
    .notNull()
    .default(sql`ARRAY['en']::text[]`),
  timezone: text().notNull().default('Asia/Kolkata'),
  onboardingStep: text().notNull().default('industry'),
  onboardingCompletedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/**
 * Append-only and tamper-evident: a trigger numbers each row per organisation (`seq`) and
 * hash-chains it to the previous one; UPDATE, DELETE and TRUNCATE are blocked for every role.
 * No foreign keys on purpose: the audit trail must outlive the users and organisations it describes.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    orgId: text().notNull(),
    seq: bigint({ mode: 'number' }),
    actorUserId: text(),
    action: text().notNull(),
    targetType: text(),
    targetId: text(),
    metadata: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    ip: text(),
    userAgent: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    prevHash: bytea(),
    hash: bytea(),
  },
  (t) => [uniqueIndex().on(t.orgId, t.seq)],
);
