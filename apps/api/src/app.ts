import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { healthRouter } from './routes/health';
import { createAuthRouter } from './routes/auth/auth-router';
import { createProbeRouter } from './routes/_probe/probe-router';
import { createDocumentsRouter } from './routes/documents/documents-router';
import type { Db } from './infrastructure/db';
import type { AppConfig } from './config';
import type { Logger } from './lib/logger';

export interface AppDeps {
  db: Db;
  config: Pick<AppConfig, 'JWT_SECRET' | 'DOCUMENT_STORAGE_PATH'>;
  logger: Logger;
}

export function createApp(deps?: AppDeps): Hono {
  const app = new Hono();
  app.use('*', cors());
  app.route('/', healthRouter);
  if (deps) {
    app.route('/', createAuthRouter(deps));
    app.route('/api/_probe', createProbeRouter(deps));
    app.route('/', createDocumentsRouter(deps));
  }
  return app;
}
