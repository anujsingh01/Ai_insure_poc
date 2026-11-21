import { ApiEnv, parseEnv } from '@ai-insure/shared';
import { createApp } from './bootstrap.js';

const env = parseEnv(ApiEnv);
const app = await createApp(env);
await app.listen(env.API_PORT);
