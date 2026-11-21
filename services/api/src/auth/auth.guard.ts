import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { schema } from '@ai-insure/db';
import { hasAnyRole, parseRoles, type OrgRole } from '@ai-insure/shared';
import { fromNodeHeaders } from 'better-auth/node';
import { and, eq } from 'drizzle-orm';
import type { Request } from 'express';
import { TenantDb } from '../infra/infra.module.js';
import { AUTH } from './auth.module.js';
import type { Auth } from './auth.factory.js';
import { IS_PUBLIC, REQUIRED_ROLES, REQUIRES_ORG } from './decorators.js';

/**
 * Global guard. Deny by default: every route needs a valid session unless marked @Public().
 * For @OrgScoped() routes the tenant is taken from the server-side session's active
 * organisation (never from the request), and membership is re-checked on every request so
 * removing someone from an organisation takes effect immediately.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUTH) private readonly auth: Auth,
    private readonly db: TenantDb,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const result = await this.auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!result) throw new UnauthorizedException();

    req.auth = {
      userId: result.user.id,
      email: result.user.email,
      name: result.user.name,
      emailVerified: result.user.emailVerified,
      sessionId: result.session.id,
      activeOrganizationId: (result.session as { activeOrganizationId?: string | null }).activeOrganizationId ?? null,
    };

    if (!this.reflector.getAllAndOverride<boolean>(REQUIRES_ORG, targets)) return true;

    const orgId = req.auth.activeOrganizationId;
    if (!orgId) throw new ForbiddenException('No active organisation');

    const [membership] = await this.db.global
      .select({ role: schema.member.role })
      .from(schema.member)
      .where(and(eq(schema.member.organizationId, orgId), eq(schema.member.userId, req.auth.userId)))
      .limit(1);
    if (!membership) throw new ForbiddenException('Not a member of this organisation');

    const roles = parseRoles(membership.role);
    const required = this.reflector.getAllAndOverride<OrgRole[]>(REQUIRED_ROLES, targets) ?? [];
    if (!hasAnyRole(roles, required)) throw new ForbiddenException('Insufficient role');

    req.tenant = { orgId, userId: req.auth.userId, roles };
    return true;
  }
}
