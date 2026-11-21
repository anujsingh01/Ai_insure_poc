import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { organization, twoFactor } from 'better-auth/plugins';
import { adminAc, defaultStatements, memberAc, ownerAc } from 'better-auth/plugins/organization/access';
import { createAccessControl } from 'better-auth/plugins/access';
import type { EmailJob } from '@ai-insure/shared';

/**
 * Organisation-management permissions enforced by Better Auth itself (members, invitations,
 * org settings). Product permissions (tickets, KYC review, …) are enforced by our own guards.
 */
const ac = createAccessControl(defaultStatements);
export const orgRoles = {
  owner: ownerAc,
  admin: adminAc,
  supervisor: ac.newRole(memberAc.statements),
  agent: ac.newRole(memberAc.statements),
  reviewer: ac.newRole(memberAc.statements),
  developer: ac.newRole(memberAc.statements),
  viewer: ac.newRole(memberAc.statements),
};

export interface AuthDeps {
  // Typed loosely so this factory can also be loaded by the Better Auth CLI with a mock database.
  db: Parameters<typeof drizzleAdapter>[0];
  schema?: Record<string, unknown>;
  baseURL: string;
  secret: string;
  trustedOrigins: string[];
  production: boolean;
  requireEmailVerification: boolean;
  google?: { clientId: string; clientSecret: string };
  sendEmail: (job: EmailJob) => Promise<void>;
  onOrganizationCreated?: (data: { organizationId: string; userId: string }) => Promise<void>;
}

export function createAuth(deps: AuthDeps) {
  return betterAuth({
    appName: 'AI Insure',
    baseURL: deps.baseURL,
    basePath: '/api/auth',
    secret: deps.secret,
    trustedOrigins: deps.trustedOrigins,
    database: drizzleAdapter(deps.db, { provider: 'pg', schema: deps.schema }),
    telemetry: { enabled: false },

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: deps.requireEmailVerification,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await deps.sendEmail({
          to: user.email,
          subject: 'Reset your AI Insure password',
          text: `Use this link to set a new password. It expires in one hour.\n\n${url}\n\nIf you did not ask for this, ignore this email.`,
          template: 'auth.reset-password',
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await deps.sendEmail({
          to: user.email,
          subject: 'Confirm your email for AI Insure',
          text: `Welcome to AI Insure. Confirm your email address to continue:\n\n${url}`,
          template: 'auth.verify-email',
        });
      },
    },
    socialProviders: deps.google?.clientId
      ? { google: { clientId: deps.google.clientId, clientSecret: deps.google.clientSecret } }
      : {},

    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 60, max: 3 },
        '/forget-password': { window: 300, max: 3 },
        '/two-factor/verify-totp': { window: 60, max: 5 },
      },
    },
    advanced: {
      cookiePrefix: 'aii',
      useSecureCookies: deps.production,
      // Better Auth turns these off when it detects a test run; pin them on so tests exercise production behaviour.
      disableOriginCheck: false,
      disableCSRFCheck: false,
      defaultCookieAttributes: { sameSite: 'lax', httpOnly: true },
    },

    plugins: [
      organization({
        ac,
        roles: orgRoles,
        creatorRole: 'owner',
        allowUserToCreateOrganization: true,
        organizationLimit: 5,
        membershipLimit: 200,
        invitationExpiresIn: 60 * 60 * 24 * 7,
        sendInvitationEmail: async ({ email, organization: org, inviter, id }) => {
          await deps.sendEmail({
            to: email,
            subject: `You're invited to ${org.name} on AI Insure`,
            text: `${inviter.user.name} invited you to join ${org.name}.\n\nAccept: ${deps.baseURL}/accept-invitation/${id}`,
            template: 'org.invitation',
          });
        },
        organizationHooks: {
          afterCreateOrganization: async ({ organization: org, user }) => {
            await deps.onOrganizationCreated?.({ organizationId: org.id, userId: user.id });
          },
        },
      }),
      twoFactor({ issuer: 'AI Insure' }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
