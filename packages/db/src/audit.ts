import { desc, eq, sql } from 'drizzle-orm';
import type { TenantTx } from './client.js';
import { user } from './schema/auth.js';
import { auditLog } from './schema/tenant.js';

export interface AuditEntry {
  actorUserId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}

/** Records an audit event for the transaction's tenant. `org_id` comes from the tenant context, not the caller. */
export async function recordAudit(tx: TenantTx, entry: AuditEntry): Promise<void> {
  await tx.insert(auditLog).values({
    orgId: sql`current_setting('app.tenant_id')`,
    actorUserId: entry.actorUserId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    metadata: entry.metadata ?? {},
    ip: entry.ip ?? null,
    userAgent: entry.userAgent?.slice(0, 512) ?? null,
  });
}

export async function listAudit(tx: TenantTx, limit = 50) {
  return tx
    .select({
      id: auditLog.id,
      actorUserId: auditLog.actorUserId,
      // Users can be deleted later; the entry keeps the id and the name is simply absent.
      actorName: user.name,
      action: auditLog.action,
      targetType: auditLog.targetType,
      targetId: auditLog.targetId,
      metadata: auditLog.metadata,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .leftJoin(user, eq(user.id, auditLog.actorUserId))
    .orderBy(desc(auditLog.id))
    .limit(Math.min(Math.max(limit, 1), 200));
}

/** Recomputes the hash chain for the tenant. Returns the id of the first broken row, or null if intact. */
export async function verifyAuditChain(tx: TenantTx): Promise<number | null> {
  const result = await tx.execute<{ id: number }>(sql`select audit_first_broken_link() as id`);
  return result.rows[0]?.id ?? null;
}
