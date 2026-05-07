import { Hono } from 'hono';
import { healthResponseSchema } from '@medbridge/contracts/health';

export const healthRouter = new Hono();

healthRouter.get('/health', (c) => {
  // Parse-then-emit so the contract is the single source of truth.
  const body = healthResponseSchema.parse({ status: 'ok' });
  return c.json(body, 200);
});
