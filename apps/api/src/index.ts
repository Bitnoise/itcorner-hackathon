import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = createApp();

serve({ fetch: app.fetch, port: config.API_PORT }, (info) => {
  process.stdout.write(`API listening on http://localhost:${info.port}\n`);
});
