import { Body, Controller, Get, NotFoundException, Patch, Query } from '@nestjs/common';
import { listAudit, recordAudit, schema, verifyAuditChain } from '@ai-insure/db';
import { ADMIN_ROLES, Industry } from '@ai-insure/shared';
import { z } from 'zod';
import { ZodBody } from '../common/zod.pipe.js';
import { ClientInfo, CurrentTenant, OrgScoped, type TenantContext } from '../auth/decorators.js';
import { TenantDb } from '../infra/infra.module.js';

export const ONBOARDING_STEPS = ['industry', 'business', 'knowledge', 'customers', 'review', 'test', 'channels', 'done'] as const;

const UpdateProfile = z
  .object({
    industry: Industry.optional(),
    languages: z.array(z.enum(['en', 'hi', 'hinglish', 'ta', 'te', 'mr', 'bn', 'gu', 'kn', 'ml'])).min(1).max(10).optional(),
    timezone: z.string().max(64).optional(),
    onboardingStep: z.enum(ONBOARDING_STEPS).optional(),
  })
  .strict();

@Controller('org')
export class OrgController {
  constructor(private readonly db: TenantDb) {}

  @Get('profile')
  @OrgScoped()
  async profile(@CurrentTenant() t: TenantContext) {
    const [row] = await this.db.run(t.orgId, (tx) => tx.select().from(schema.orgProfile).limit(1));
    if (!row) throw new NotFoundException();
    return row;
  }

  @Patch('profile')
  @OrgScoped(...ADMIN_ROLES)
  async updateProfile(
    @CurrentTenant() t: TenantContext,
    @ClientInfo() client: ClientInfo,
    @Body(new ZodBody(UpdateProfile)) body: z.infer<typeof UpdateProfile>,
  ) {
    return this.db.run(t.orgId, async (tx) => {
      const [row] = await tx
        .update(schema.orgProfile)
        .set({ ...body, ...(body.onboardingStep === 'done' ? { onboardingCompletedAt: new Date() } : {}) })
        .returning();
      if (!row) throw new NotFoundException();
      await recordAudit(tx, {
        actorUserId: t.userId,
        action: 'org.profile.updated',
        targetType: 'org_profile',
        targetId: t.orgId,
        metadata: { fields: Object.keys(body) },
        ...client,
      });
      return row;
    });
  }

  @Get('audit')
  @OrgScoped(...ADMIN_ROLES)
  async audit(@CurrentTenant() t: TenantContext, @Query('limit') limit?: string) {
    return this.db.run(t.orgId, async (tx) => ({
      entries: await listAudit(tx, Number(limit) || 50),
      chainIntact: (await verifyAuditChain(tx)) === null,
    }));
  }
}
