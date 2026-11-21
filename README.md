# AI Insure

Self-serve SaaS: an AI voice agent, ticketing, WhatsApp KYC and automated follow-ups for Indian financial-services businesses.

- Product and architecture: [SAAS-PLAN.md](SAAS-PLAN.md) (self-serve plan, milestones) and [PLAN.md](PLAN.md) (platform design).
- Stack: TypeScript everywhere. NestJS API, BullMQ worker, Angular 22 console, PostgreSQL + pgvector, Redis.

## Repository layout

```
apps/web            Angular console: sign-up, onboarding, console
services/api        NestJS API: auth (Better Auth), tenancy, REST endpoints
services/worker     BullMQ worker: email now; KYC, follow-ups, CRM sync later
packages/db         Drizzle schema, migrations (incl. RLS + audit log), tenant-scoped DB access
packages/shared     Zod schemas, roles, env validation, log redaction
infra/docker        Local database bootstrap
```

## Run it locally

Needs Node 22.12+ and Docker.

```bash
npm install
```

```bash
cp .env.example .env
```

Set `BETTER_AUTH_SECRET` in `.env` (for example with `openssl rand -base64 32`), then:

```bash
npm run infra:up
```

```bash
npm run build && npm run db:migrate
```

Start each in its own terminal:

```bash
npm run start:api
```

```bash
npm run start:worker
```

```bash
npm run dev:web
```

Open http://localhost:4200 and sign up. Confirmation and password-reset emails land in Mailpit at http://localhost:8125.

Local ports are offset so they don't clash with other stacks: API 3100, Postgres 54320, Redis 63790, Mailpit 8125.

## Tests

```bash
npm test
```

`packages/db` and `services/api` start throwaway Postgres and Redis containers (Docker must be running). They prove that:

- one tenant can never read or write another tenant's rows, and the tenant setting never leaks between pooled requests;
- the API connects as a role that cannot bypass row-level security;
- the audit log is append-only for every role, and tampering by a database superuser is detected;
- unauthenticated requests are refused, requests from untrusted origins are refused, and input is strictly validated.

## Security model (M0)

| Concern | How |
|---|---|
| Tenant isolation | Postgres row-level security, `FORCE`d on every tenant table. Tenant comes from the server-side session, set per transaction with `withTenant()`. The runtime role `app_user` owns nothing and has no `BYPASSRLS`. Migrations run as a separate owner role. |
| Authentication | Better Auth inside the API: email + password (10+ chars), Google, email verification, password reset, TOTP two-factor, organisations and invitations. httpOnly, SameSite=Lax cookies; secure cookies in production. Rate limits on sign-in, sign-up, reset and 2FA. Origin/CSRF checks always on. |
| Authorisation | Global guard: every route needs a session unless marked `@Public()`. `@OrgScoped(...roles)` re-checks membership on every request. |
| Audit | Append-only `audit_log`, numbered and SHA-256 hash-chained per organisation; UPDATE/DELETE/TRUNCATE blocked by trigger for all roles. Integrity is checked when the log is read. |
| Logging | pino with redaction of credentials, cookies and personal data (PAN, Aadhaar, email, phone). Query strings are not logged. |
| HTTP | Helmet (strict CSP for the JSON API), CORS limited to the console origin, 1 MB body limit, global rate limit. |
| Supply chain | CI: type-check, build, tests; gitleaks; `npm audit` (prod, high+); Trivy; CodeQL; Dependabot. |

## Database changes

Edit `packages/db/src/schema/*.ts`, then:

```bash
npm run db:generate
```

A new tenant table must also get `ENABLE` + `FORCE ROW LEVEL SECURITY` and a `tenant_isolation` policy in a migration. Copy the `org_profile` block in `migrations/0001_security.sql`.

Better Auth's tables (`packages/db/src/schema/auth.ts`) are generated. After changing auth plugins in `services/api/src/auth/auth.factory.ts`, regenerate them (command at the top of that file).
