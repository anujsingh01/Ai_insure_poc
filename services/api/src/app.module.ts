import { Module, type DynamicModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LOG_REDACT_PATHS } from '@ai-insure/shared';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { AuthGuard } from './auth/auth.guard.js';
import { AuthModule } from './auth/auth.module.js';
import type { ApiEnv } from './config/env.js';
import { HealthController } from './health/health.controller.js';
import { InfraModule } from './infra/infra.module.js';
import { MeController } from './me/me.controller.js';
import { OrgController } from './org/org.controller.js';

@Module({})
export class AppModule {
  static forRoot(env: ApiEnv): DynamicModule {
    return {
      module: AppModule,
      imports: [
        LoggerModule.forRoot({
          pinoHttp: {
            level: env.LOG_LEVEL,
            redact: { paths: LOG_REDACT_PATHS, censor: '[redacted]' },
            genReqId: (req, res) => {
              const id = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
              res.setHeader('x-request-id', id);
              return id;
            },
            // Log the route, never the query string (it can carry tokens, e.g. email verification).
            serializers: { req: (req) => ({ id: req.id, method: req.method, url: String(req.url).split('?')[0] }) },
            autoLogging: { ignore: (req) => req.url?.startsWith('/api/health') ?? false },
            ...(env.NODE_ENV === 'development' ? { transport: { target: 'pino-pretty', options: { singleLine: true } } } : {}),
          },
        }),
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
        InfraModule.forRoot(env),
        AuthModule,
      ],
      controllers: [HealthController, MeController, OrgController],
      providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_GUARD, useClass: AuthGuard },
      ],
    };
  }
}
