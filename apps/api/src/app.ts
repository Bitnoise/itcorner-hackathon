import { Hono } from 'hono';
import { cors } from 'hono/cors';

export function createApp(): Hono {
  const app = new Hono();
  app.use('*', cors());
  // Routes are registered here as slices land. Slice 1 wires GET /health.
  return app;
}
