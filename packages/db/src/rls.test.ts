import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { eq, sql } from 'drizzle-orm';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { listAudit, recordAudit, verifyAuditChain } from './audit.js';
import { createDb, withTenant, type DbHandle } from './client.js';
import { runMigrations } from './migrate.js';
import { orgProfile } from './schema/tenant.js';

/**
 * Proves tenant isolation against a real Postgres, connecting as the same non-owner role the
 * API uses. If any of these fail, one customer could see another customer's data.
 */

let container: StartedPostgreSqlContainer;

/** Drizzle wraps driver errors; the Postgres message is on `cause`. */
async function pgErrorOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    const err = e as Error & { cause?: Error };
    return err.cause?.message ?? err.message;
  }
  return 'no error';
}
let owner: pg.Client;
let app: DbHandle;

const ORG_A = 'org_a';
const ORG_B = 'org_b';

beforeAll(async () => {
  container = await new PostgreSqlContainer('pgvector/pgvector:pg17')
    .withUsername('app_owner')
    .withPassword('owner')
    .withDatabase('ai_insure')
    .start();
  const ownerUrl = container.getConnectionUri();
  owner = new pg.Client({ connectionString: ownerUrl });
  await owner.connect();
  await owner.query(`CREATE ROLE app_user LOGIN PASSWORD 'app' NOBYPASSRLS`);
  await runMigrations(ownerUrl);

  // Auth tables are global (not tenant-scoped), so the owner seeds them directly.
  await owner.query(`
    INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
      VALUES ('u1', 'User One', 'one@example.com', true, now(), now());
    INSERT INTO organization (id, name, slug, created_at) VALUES
      ('${ORG_A}', 'Org A', 'org-a', now()), ('${ORG_B}', 'Org B', 'org-b', now());
  `);

  const appUrl = ownerUrl.replace('app_owner:owner', 'app_user:app');
  // A single connection makes it certain that tenant settings would leak if they weren't transaction-local.
  app = createDb(appUrl, { max: 1 });

  await withTenant(app.db, ORG_A, (tx) => tx.insert(orgProfile).values({ orgId: ORG_A, industry: 'insurance' }));
  await withTenant(app.db, ORG_B, (tx) => tx.insert(orgProfile).values({ orgId: ORG_B, industry: 'lending' }));
}, 180_000);

afterAll(async () => {
  await app?.close();
  await owner?.end();
  await container?.stop();
});

describe('row-level security', () => {
  it('runs as a role that cannot bypass RLS', async () => {
    const { rows } = await app.pool.query(
      `SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`,
    );
    expect(rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });
  });

  it('shows a tenant only its own rows', async () => {
    const rows = await withTenant(app.db, ORG_A, (tx) => tx.select().from(orgProfile));
    expect(rows.map((r) => r.orgId)).toEqual([ORG_A]);
  });

  it('returns nothing when no tenant is set', async () => {
    const rows = await app.db.select().from(orgProfile);
    expect(rows).toEqual([]);
  });

  it('does not leak the tenant to the next query on the same connection', async () => {
    await withTenant(app.db, ORG_A, (tx) => tx.select().from(orgProfile));
    const { rows } = await app.pool.query(`SELECT app_current_tenant() AS t, count(*)::int AS n FROM org_profile`);
    expect(rows[0]).toEqual({ t: null, n: 0 });
  });

  it("rejects writing a row into another tenant", async () => {
    const msg = await pgErrorOf(
      withTenant(app.db, ORG_A, (tx) =>
        tx.update(orgProfile).set({ orgId: ORG_B }).where(eq(orgProfile.orgId, ORG_A)),
      ),
    );
    expect(msg).toMatch(/row-level security/);
  });

  it("cannot update another tenant's rows", async () => {
    const updated = await withTenant(app.db, ORG_A, (tx) =>
      tx.update(orgProfile).set({ industry: 'hacked' }).where(eq(orgProfile.orgId, ORG_B)).returning(),
    );
    expect(updated).toEqual([]);
    const { rows } = await owner.query(`SELECT industry FROM org_profile WHERE org_id = $1`, [ORG_B]);
    expect(rows[0].industry).toBe('lending');
  });

  it('rejects malformed tenant ids', async () => {
    await expect(withTenant(app.db, "x' OR 1=1 --", async () => 1)).rejects.toThrow(/invalid organisation id/);
  });
});

describe('audit log', () => {
  beforeAll(async () => {
    for (const action of ['org.created', 'member.invited', 'settings.updated']) {
      await withTenant(app.db, ORG_A, (tx) => recordAudit(tx, { actorUserId: 'u1', action }));
    }
    await withTenant(app.db, ORG_B, (tx) => recordAudit(tx, { actorUserId: 'u1', action: 'org.created' }));
  });

  it('is scoped to the tenant and numbered per tenant', async () => {
    const a = await withTenant(app.db, ORG_A, (tx) => listAudit(tx));
    expect(a.map((r) => r.action)).toEqual(['settings.updated', 'member.invited', 'org.created']);
    const { rows } = await owner.query(`SELECT org_id, seq FROM audit_log ORDER BY id`);
    expect(rows).toEqual([
      { org_id: ORG_A, seq: '1' },
      { org_id: ORG_A, seq: '2' },
      { org_id: ORG_A, seq: '3' },
      { org_id: ORG_B, seq: '1' },
    ]);
  });

  it('cannot be written for another tenant', async () => {
    const msg = await pgErrorOf(
      withTenant(app.db, ORG_A, (tx) => tx.execute(sql`insert into audit_log (org_id, action) values (${ORG_B}, 'forged')`)),
    );
    expect(msg).toMatch(/row-level security/);
  });

  it('cannot be updated or deleted, even by the owner', async () => {
    expect(await pgErrorOf(withTenant(app.db, ORG_A, (tx) => tx.execute(sql`update audit_log set action = 'x'`)))).toMatch(
      /permission denied/,
    );
    expect(await pgErrorOf(withTenant(app.db, ORG_A, (tx) => tx.execute(sql`delete from audit_log`)))).toMatch(
      /permission denied/,
    );
    await expect(owner.query(`UPDATE audit_log SET action = 'x'`)).rejects.toThrow(/append-only/);
    await expect(owner.query(`DELETE FROM audit_log`)).rejects.toThrow(/append-only/);
  });

  it('has an intact hash chain', async () => {
    expect(await withTenant(app.db, ORG_A, (tx) => verifyAuditChain(tx))).toBeNull();
    expect(await withTenant(app.db, ORG_B, (tx) => verifyAuditChain(tx))).toBeNull();
  });

  it('detects tampering by someone with database superuser access', async () => {
    await owner.query(`ALTER TABLE audit_log DISABLE TRIGGER audit_log_no_update`);
    await owner.query(`UPDATE audit_log SET action = 'nothing.to.see' WHERE org_id = $1 AND seq = 2`, [ORG_A]);
    await owner.query(`ALTER TABLE audit_log ENABLE TRIGGER audit_log_no_update`);
    const { rows } = await owner.query(`SELECT id FROM audit_log WHERE org_id = $1 AND seq = 2`, [ORG_A]);
    const broken = await withTenant(app.db, ORG_A, (tx) => verifyAuditChain(tx));
    expect(String(broken)).toBe(String(rows[0].id));
  });
});
