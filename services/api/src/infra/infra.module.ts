import { Global, Inject, Injectable, Module, type OnApplicationShutdown, type DynamicModule } from '@nestjs/common';
import { createDb, withTenant, type Database, type DbHandle, type TenantTx } from '@ai-insure/db';
import { EmailJob, QUEUES } from '@ai-insure/shared';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { ENV, type ApiEnv } from '../config/env.js';

export const DB = Symbol('DB');
export const REDIS = Symbol('REDIS');
export const EMAIL_QUEUE = Symbol('EMAIL_QUEUE');

/** The only way services get a database handle for tenant data. */
@Injectable()
export class TenantDb {
  constructor(@Inject(DB) private readonly handle: DbHandle) {}

  run<T>(orgId: string, fn: (tx: TenantTx) => Promise<T>): Promise<T> {
    return withTenant(this.handle.db, orgId, fn);
  }

  /** Global (non-tenant) tables: users, organisations, memberships. Never use for tenant tables. */
  get global(): Database {
    return this.handle.db;
  }

  async ping(): Promise<void> {
    await this.handle.pool.query('select 1');
  }
}

@Injectable()
export class Mailer {
  constructor(@Inject(EMAIL_QUEUE) private readonly queue: Queue) {}

  async send(job: EmailJob): Promise<void> {
    const data = EmailJob.parse(job);
    await this.queue.add(data.template, data, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: 1_000,
      removeOnFail: 5_000,
    });
  }
}

@Injectable()
class Shutdown implements OnApplicationShutdown {
  constructor(
    @Inject(DB) private readonly db: DbHandle,
    @Inject(EMAIL_QUEUE) private readonly queue: Queue,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await this.queue.close();
    await Promise.allSettled([this.redis.quit(), this.db.close()]);
  }
}

@Global()
@Module({})
export class InfraModule {
  static forRoot(env: ApiEnv): DynamicModule {
    return {
      module: InfraModule,
      providers: [
        { provide: ENV, useValue: env },
        { provide: DB, useFactory: () => createDb(env.DATABASE_URL, { applicationName: 'ai-insure-api' }) },
        // BullMQ in native ESM needs a constructed client; it requires maxRetriesPerRequest: null.
        { provide: REDIS, useFactory: () => new Redis(env.REDIS_URL, { maxRetriesPerRequest: null }) },
        {
          provide: EMAIL_QUEUE,
          inject: [REDIS],
          useFactory: (redis: Redis) => new Queue(QUEUES.email, { connection: redis }),
        },
        TenantDb,
        Mailer,
        Shutdown,
      ],
      exports: [ENV, DB, REDIS, EMAIL_QUEUE, TenantDb, Mailer],
    };
  }
}
