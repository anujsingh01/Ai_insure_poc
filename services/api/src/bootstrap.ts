import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { toNodeHandler } from 'better-auth/node';
import express from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { AUTH } from './auth/auth.module.js';
import type { Auth } from './auth/auth.factory.js';
import type { ApiEnv } from './config/env.js';

/** Builds the configured application without listening. Shared by main.ts and the e2e tests. */
export async function createApp(env: ApiEnv): Promise<NestExpressApplication> {
  // Body parsing is added below, after the auth handler, which must read the raw request itself.
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(env), {
    bodyParser: false,
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  // Behind exactly one proxy (the load balancer) in production, so req.ip is the client's address.
  app.set('trust proxy', env.NODE_ENV === 'production' ? 1 : false);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // The API serves JSON only; lock everything down.
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.enableCors({ origin: [env.WEB_ORIGIN], credentials: true });

  const auth = app.get<Auth>(AUTH);
  // A route (not app.use) so Express keeps the full URL that Better Auth matches against.
  (app.getHttpAdapter().getInstance() as express.Express).all('/api/auth/{*any}', toNodeHandler(auth));

  app.use(express.json({ limit: '1mb' }));
  app.setGlobalPrefix('api');

  return app;
}
