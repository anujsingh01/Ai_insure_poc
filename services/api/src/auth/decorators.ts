import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { OrgRole } from '@ai-insure/shared';
import type { Request } from 'express';

export const IS_PUBLIC = 'auth:public';
export const REQUIRED_ROLES = 'auth:roles';
export const REQUIRES_ORG = 'auth:org';

/** Route needs no session. Everything else requires a signed-in user by default. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/**
 * Route acts on the active organisation. The guard checks membership and loads the role.
 * Pass roles to restrict further; with none, any member may call it.
 */
export const OrgScoped = (...roles: OrgRole[]) => (target: object, key?: string | symbol, desc?: PropertyDescriptor) => {
  SetMetadata(REQUIRES_ORG, true)(target, key!, desc!);
  SetMetadata(REQUIRED_ROLES, roles)(target, key!, desc!);
};

export interface AuthContext {
  userId: string;
  email: string;
  name: string;
  emailVerified: boolean;
  sessionId: string;
  activeOrganizationId: string | null;
}

export interface TenantContext {
  orgId: string;
  userId: string;
  roles: OrgRole[];
}

declare module 'express' {
  interface Request {
    auth?: AuthContext;
    tenant?: TenantContext;
  }
}

export const CurrentAuth = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthContext => {
  const req = ctx.switchToHttp().getRequest<Request>();
  if (!req.auth) throw new Error('CurrentAuth used on a route without a session');
  return req.auth;
});

export const CurrentTenant = createParamDecorator((_: unknown, ctx: ExecutionContext): TenantContext => {
  const req = ctx.switchToHttp().getRequest<Request>();
  if (!req.tenant) throw new Error('CurrentTenant used on a route that is not @OrgScoped()');
  return req.tenant;
});

/** Client details for audit entries. Express resolves the IP from X-Forwarded-For only behind a trusted proxy. */
export const ClientInfo = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<Request>();
  return { ip: req.ip ?? null, userAgent: req.get('user-agent') ?? null };
});
export type ClientInfo = { ip: string | null; userAgent: string | null };
