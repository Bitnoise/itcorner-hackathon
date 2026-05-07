import { readFileSync, existsSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { createApp } from './app';
import { loadConfig } from './config';
import { checkEnv } from './lib/env-guard';
import { createLogger } from './lib/logger';
import { createDb } from './infrastructure/db';

const rootEnv = resolve(dirname(fileURLToPath(import.meta.url)), '../../..', '.env');
if (existsSync(rootEnv)) {
  for (const line of readFileSync(rootEnv, 'utf-8').split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim();
    if (key && !(key in process.env)) process.env[key] = val;
  }
}

checkEnv();
const config = loadConfig();
const logger = createLogger();

// Ensure document storage directory exists on startup
mkdirSync(config.DOCUMENT_STORAGE_PATH, { recursive: true });

const db = createDb(config.DATABASE_URL);
const app = createApp({ db, config, logger });

serve({ fetch: app.fetch, port: config.API_PORT }, (info) => {
  logger.info('server.start', { port: info.port });
});
