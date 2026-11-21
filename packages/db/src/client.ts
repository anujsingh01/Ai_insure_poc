import { sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema/index.js';

export type Schema = typeof schema;
export type Database = NodePgDatabase<Schema>;
/** A transaction scoped to one tenant. Only obtainable through {@link withTenant}. */
export type TenantTx = Parameters<Parameters<Database['transaction']>[0]>[0] & { readonly __tenant: unique symbol };

export interface DbHandle {
  db: Database;
  pool: pg.Pool;
  close(): Promise<void>;
}

export function createDb(url: string, opts: { max?: number; applicationName?: string } = {}): DbHandle {
  const pool = new pg.Pool({
    connectionString: url,
    max: opts.max ?? 10,
    application_name: opts.applicationName ?? 'ai-insure',
    // Fail fast instead of piling up requests when the database is unreachable.
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
  });
  const db = drizzle(pool, { schema, casing: 'snake_case' });
  return { db, pool, close: () => pool.end() };
}

const ORG_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Runs `fn` in a transaction where Postgres row-level security is bound to `orgId`.
 *
 * The tenant is set with `set_config(..., is_local => true)`, so it is cleared when the
 * transaction ends and can never leak to the next request that reuses the pooled connection.
 * Tenant tables have FORCE ROW LEVEL SECURITY, so forgetting to call this returns no rows
 * rather than every tenant's rows.
 */
export async function withTenant<T>(db: Database, orgId: string, fn: (tx: TenantTx) => Promise<T>): Promise<T> {
  if (!ORG_ID.test(orgId)) throw new Error('withTenant: invalid organisation id');
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${orgId}, true)`);
    return fn(tx as TenantTx);
  });
}
