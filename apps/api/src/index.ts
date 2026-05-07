import { serve } from '@hono/node-server';
import { createApp } from './app';
import { loadConfig } from './config';
import { checkEnv } from './lib/env-guard';
import { createLogger } from './lib/logger';
import { createDb } from './infrastructure/db';

checkEnv();
const config = loadConfig();
const logger = createLogger();
const db = createDb(config.DATABASE_URL);
const app = createApp({ db, config, logger });

serve({ fetch: app.fetch, port: config.API_PORT }, (info) => {
  logger.info('server.start', { port: info.port });
});
