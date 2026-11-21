import { runMigrations } from '@ai-insure/db';
import { ApiEnv } from '@ai-insure/shared';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import request from 'supertest';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// Nest relies on decorator metadata that only tsc emits, so the test drives the compiled app.
import { createApp } from '../dist/bootstrap.js';

const WEB_ORIGIN = 'http://localhost:4200';

let pgc: StartedPostgreSqlContainer;
let redis: StartedTestContainer;
let app: NestExpressApplication;
let http: ReturnType<typeof request>;

/** Signs up a user and returns their session cookie. */
async function signUp(name: string, email: string): Promise<string[]> {
  const res = await http
    .post('/api/auth/sign-up/email')
    .set('Origin', WEB_ORIGIN)
    .send({ name, email, password: 'correct-horse-battery' });
  expect(res.status, res.text).toBe(200);
  const cookies = res.get('Set-Cookie');
  expect(cookies?.length).toBeGreaterThan(0);
  return cookies!;
}

async function createOrg(cookie: string[], name: string, slug: string): Promise<string> {
  const res = await http.post('/api/auth/organization/create').set('Origin', WEB_ORIGIN).set('Cookie', cookie).send({ name, slug });
  expect(res.status, res.text).toBe(200);
  return res.body.id;
}

/** Better Auth refreshes the session cookie cache when the active org changes; keep the newest cookies. */
function merge(cookie: string[], res: request.Response): string[] {
  const fresh = res.get('Set-Cookie') ?? [];
  const names = new Set(fresh.map((c) => c.split('=')[0]));
  return [...cookie.filter((c) => !names.has(c.split('=')[0])), ...fresh];
}

beforeAll(async () => {
  [pgc, redis] = await Promise.all([
    new PostgreSqlContainer('pgvector/pgvector:pg17').withUsername('app_owner').withPassword('owner').withDatabase('ai_insure').start(),
    new GenericContainer('redis:7.4-alpine').withExposedPorts(6379).start(),
  ]);
  const ownerUrl = pgc.getConnectionUri();
  const owner = new pg.Client({ connectionString: ownerUrl });
  await owner.connect();
  await owner.query(`CREATE ROLE app_user LOGIN PASSWORD 'app' NOBYPASSRLS`);
  await owner.end();
  await runMigrations(ownerUrl);

  const env = ApiEnv.parse({
    NODE_ENV: 'test',
    LOG_LEVEL: 'warn',
    DATABASE_URL: ownerUrl.replace('app_owner:owner', 'app_user:app'),
    REDIS_URL: `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`,
    WEB_ORIGIN,
    BETTER_AUTH_URL: WEB_ORIGIN,
    BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret-1234',
    REQUIRE_EMAIL_VERIFICATION: 'false',
  });
  app = await createApp(env);
  await app.init();
  http = request(app.getHttpServer());
}, 240_000);

afterAll(async () => {
  await app?.close();
  await Promise.all([pgc?.stop(), redis?.stop()]);
});

describe('API', () => {
  let alice: string[];
  let bob: string[];
  let aliceOrg: string;
  let bobOrg: string;

  it('serves health checks without a session', async () => {
    await http.get('/api/health/live').expect(200, { status: 'ok' });
    const ready = await http.get('/api/health/ready');
    expect(ready.body).toEqual({ status: 'ok', db: 'ok', redis: 'ok' });
  });

  it('denies everything else without a session', async () => {
    await http.get('/api/me').expect(401);
    await http.get('/api/org/profile').expect(401);
  });

  it('sets security headers', async () => {
    const res = await http.get('/api/health/live');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('signs users up and creates their organisations with a tenant profile', async () => {
    alice = await signUp('Alice', 'alice@example.com');
    bob = await signUp('Bob', 'bob@example.com');

    // Before choosing an organisation, org-scoped routes are refused.
    await http.get('/api/org/profile').set('Cookie', alice).expect(403);

    aliceOrg = await createOrg(alice, 'Alice Insurance', 'alice-insurance');
    bobOrg = await createOrg(bob, 'Bob Lending', 'bob-lending');

    const set = await http
      .post('/api/auth/organization/set-active')
      .set('Origin', WEB_ORIGIN)
      .set('Cookie', alice)
      .send({ organizationId: aliceOrg });
    alice = merge(alice, set);
    const setB = await http
      .post('/api/auth/organization/set-active')
      .set('Origin', WEB_ORIGIN)
      .set('Cookie', bob)
      .send({ organizationId: bobOrg });
    bob = merge(bob, setB);

    const me = await http.get('/api/me').set('Cookie', alice).expect(200);
    expect(me.body.activeOrganizationId).toBe(aliceOrg);
    expect(me.body.organizations).toEqual([{ id: aliceOrg, name: 'Alice Insurance', slug: 'alice-insurance', role: ['owner'] }]);

    const profile = await http.get('/api/org/profile').set('Cookie', alice).expect(200);
    expect(profile.body).toMatchObject({ orgId: aliceOrg, industry: 'other', onboardingStep: 'industry' });
  });

  it("refuses to switch into an organisation the user doesn't belong to", async () => {
    const res = await http
      .post('/api/auth/organization/set-active')
      .set('Origin', WEB_ORIGIN)
      .set('Cookie', bob)
      .send({ organizationId: aliceOrg });
    expect(res.status).toBeGreaterThanOrEqual(400);
    const profile = await http.get('/api/org/profile').set('Cookie', bob).expect(200);
    expect(profile.body.orgId).toBe(bobOrg);
  });

  it('validates input strictly', async () => {
    await http.patch('/api/org/profile').set('Cookie', alice).send({ industry: 'insurance', orgId: bobOrg }).expect(400);
    await http.patch('/api/org/profile').set('Cookie', alice).send({ industry: 'crypto' }).expect(400);
  });

  it('updates the profile and records it in a verifiable audit trail', async () => {
    const res = await http
      .patch('/api/org/profile')
      .set('Cookie', alice)
      .send({ industry: 'insurance', languages: ['en', 'hi', 'hinglish'], onboardingStep: 'business' })
      .expect(200);
    expect(res.body).toMatchObject({ industry: 'insurance', languages: ['en', 'hi', 'hinglish'], onboardingStep: 'business' });

    const audit = await http.get('/api/org/audit').set('Cookie', alice).expect(200);
    expect(audit.body.chainIntact).toBe(true);
    expect(audit.body.entries.map((e: { action: string }) => e.action)).toEqual(['org.profile.updated', 'org.created']);

    // Bob's trail contains only Bob's organisation.
    const bobAudit = await http.get('/api/org/audit').set('Cookie', bob).expect(200);
    expect(bobAudit.body.entries.map((e: { targetId: string }) => e.targetId)).toEqual([bobOrg]);
  });

  it('rejects auth requests from untrusted origins', async () => {
    const res = await http
      .post('/api/auth/sign-in/email')
      .set('Origin', 'https://evil.example')
      .send({ email: 'alice@example.com', password: 'correct-horse-battery' });
    expect(res.status).toBe(403);
  });
});
