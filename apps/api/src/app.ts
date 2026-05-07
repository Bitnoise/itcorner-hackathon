import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { healthRouter } from './routes/health';

export function createApp(): Hono {
  const app = new Hono();
  app.use('*', cors());
  app.route('/', healthRouter);
  return app;
}
