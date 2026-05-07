import { Hono } from 'hono';
import { loginBodySchema } from '@medbridge/contracts/auth';
import { login } from '../../use-cases/auth/login';
import type { Db } from '../../infrastructure/db';
import type { AppConfig } from '../../config';
import type { Logger } from '../../lib/logger';

export function createLoginRoute(deps: {
  db: Db;
  config: Pick<AppConfig, 'JWT_SECRET'>;
  logger: Logger;
}): Hono {
  const router = new Hono();

  router.post('/auth/login', async (c) => {
    const contentType = c.req.header('Content-Type') ?? '';
    if (!contentType.includes('application/json')) {
      return c.json({ error: 'Unsupported Media Type' }, 415);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Unsupported Media Type' }, 415);
    }

    const parsed = loginBodySchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        {
          error: 'Validation failed',
          issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
        },
        422,
      );
    }

    const result = await login(parsed.data.email, parsed.data.password, deps);

    if (!result.ok) {
      if (result.reason === 'db_error') {
        return c.json({ error: 'Service unavailable' }, 503);
      }
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    return c.json({ token: result.token }, 200);
  });

  return router;
}
