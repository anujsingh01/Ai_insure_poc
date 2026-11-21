import { Controller, Get, HttpCode, Inject, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Queue } from 'bullmq';
import { Public } from '../auth/decorators.js';
import { EMAIL_QUEUE, TenantDb } from '../infra/infra.module.js';

@Controller('health')
@Public()
@SkipThrottle()
export class HealthController {
  constructor(
    private readonly db: TenantDb,
    @Inject(EMAIL_QUEUE) private readonly queue: Queue,
  ) {}

  /** Liveness: the process is up. */
  @Get('live')
  live() {
    return { status: 'ok' };
  }

  /** Readiness: dependencies reachable. Used by the load balancer. */
  @Get('ready')
  @HttpCode(200)
  async ready() {
    const checks = await Promise.allSettled([this.db.ping(), this.queue.count()]);
    const [db, redis] = checks.map((c) => (c.status === 'fulfilled' ? 'ok' : 'down'));
    if (db !== 'ok' || redis !== 'ok') throw new ServiceUnavailableException({ db, redis });
    return { status: 'ok', db, redis };
  }
}
