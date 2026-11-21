import { Controller, Get } from '@nestjs/common';
import { schema } from '@ai-insure/db';
import { parseRoles } from '@ai-insure/shared';
import { eq } from 'drizzle-orm';
import { CurrentAuth, type AuthContext } from '../auth/decorators.js';
import { TenantDb } from '../infra/infra.module.js';

@Controller('me')
export class MeController {
  constructor(private readonly db: TenantDb) {}

  /** The signed-in user, their organisations and which one is active. Drives the console shell. */
  @Get()
  async me(@CurrentAuth() a: AuthContext) {
    const orgs = await this.db.global
      .select({ id: schema.organization.id, name: schema.organization.name, slug: schema.organization.slug, role: schema.member.role })
      .from(schema.member)
      .innerJoin(schema.organization, eq(schema.organization.id, schema.member.organizationId))
      .where(eq(schema.member.userId, a.userId));

    return {
      user: { id: a.userId, email: a.email, name: a.name, emailVerified: a.emailVerified },
      activeOrganizationId: a.activeOrganizationId,
      organizations: orgs.map((o) => ({ ...o, role: parseRoles(o.role) })),
    };
  }
}
