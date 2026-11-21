import { z } from 'zod';

/**
 * Roles inside an organisation (tenant). Ordered from most to least privileged.
 * `owner` and `admin` are Better Auth's built-in names; the rest are ours.
 */
export const ORG_ROLES = ['owner', 'admin', 'supervisor', 'agent', 'reviewer', 'developer', 'viewer'] as const;
export const OrgRole = z.enum(ORG_ROLES);
export type OrgRole = z.infer<typeof OrgRole>;

/** Roles that may manage members, billing and settings. */
export const ADMIN_ROLES: readonly OrgRole[] = ['owner', 'admin'];

/** Better Auth stores multiple roles as a comma-separated string. */
export function parseRoles(value: string | null | undefined): OrgRole[] {
  if (!value) return [];
  return value
    .split(',')
    .map((r) => r.trim())
    .filter((r): r is OrgRole => (ORG_ROLES as readonly string[]).includes(r));
}

export function hasAnyRole(held: readonly OrgRole[], required: readonly OrgRole[]): boolean {
  return required.length === 0 || held.some((r) => required.includes(r));
}

export const INDUSTRIES = ['insurance', 'lending', 'broking', 'healthcare', 'other'] as const;
export const Industry = z.enum(INDUSTRIES);
export type Industry = z.infer<typeof Industry>;
