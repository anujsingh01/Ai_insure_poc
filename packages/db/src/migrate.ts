import { fileURLToPath, pathToFileURL } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from './client.js';

export const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations', import.meta.url));

/** Applies pending migrations. Must run as the table-owner role, never as the runtime role. */
export async function runMigrations(ownerUrl: string): Promise<void> {
  const handle = createDb(ownerUrl, { max: 1, applicationName: 'ai-insure-migrate' });
  try {
    await migrate(handle.db, { migrationsFolder: MIGRATIONS_DIR });
  } finally {
    await handle.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = process.env.DATABASE_OWNER_URL;
  if (!url) {
    console.error('DATABASE_OWNER_URL is not set');
    process.exit(1);
  }
  await runMigrations(url);
  console.log('Migrations applied');
}
