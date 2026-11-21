import { Global, Module } from '@nestjs/common';
import { recordAudit, schema } from '@ai-insure/db';
import { ENV, type ApiEnv } from '../config/env.js';
import { Mailer, TenantDb } from '../infra/infra.module.js';
import { createAuth } from './auth.factory.js';

export const AUTH = Symbol('AUTH');

@Global()
@Module({
  providers: [
    {
      provide: AUTH,
      inject: [ENV, TenantDb, Mailer],
      useFactory: (env: ApiEnv, db: TenantDb, mailer: Mailer) =>
        createAuth({
          db: db.global,
          schema,
          baseURL: env.BETTER_AUTH_URL,
          secret: env.BETTER_AUTH_SECRET,
          trustedOrigins: [env.WEB_ORIGIN],
          production: env.NODE_ENV === 'production',
          requireEmailVerification: env.REQUIRE_EMAIL_VERIFICATION,
          google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
          sendEmail: (job) => mailer.send(job),
          // Every new organisation gets its tenant profile and the first entry in its audit trail.
          onOrganizationCreated: ({ organizationId, userId }) =>
            db.run(organizationId, async (tx) => {
              await tx.insert(schema.orgProfile).values({ orgId: organizationId });
              await recordAudit(tx, { actorUserId: userId, action: 'org.created', targetType: 'organization', targetId: organizationId });
            }),
        }),
    },
  ],
  exports: [AUTH],
})
export class AuthModule {}
