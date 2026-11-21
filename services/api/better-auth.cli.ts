// Used only by `npx auth generate` to produce the Drizzle schema for Better Auth's tables
// (packages/db/src/schema/auth.ts). Not part of the running app.
import { drizzle } from 'drizzle-orm/node-postgres';
import { createAuth } from './src/auth/auth.factory.js';

export const auth = createAuth({
  db: drizzle.mock(),
  baseURL: 'http://localhost:4200',
  secret: 'cli-only-secret-cli-only-secret-cli-only',
  trustedOrigins: [],
  production: false,
  requireEmailVerification: true,
  sendEmail: async () => {},
});
