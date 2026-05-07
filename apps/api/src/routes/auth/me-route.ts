import { Hono } from 'hono';
import { requireAuth } from '../../middleware/require-auth';
import { getUserProfile } from '../../use-cases/auth/get-user-profile';
import type { Db } from '../../infrastructure/db';
import type { AppConfig } from '../../config';
import type { Logger } from '../../lib/logger';
import type { AppVariables } from '../../domain/auth/types';

export function createMeRoute(deps: {
  db: Db;
  config: Pick<AppConfig, 'JWT_SECRET'>;
  logger: Logger;
}): Hono<{ Variables: AppVariables }> {
  const router = new Hono<{ Variables: AppVariables }>();

  router.get('/auth/me', requireAuth(deps), async (c) => {
    const userId = c.get('userId');

    const result = await getUserProfile(userId, deps.db, deps.logger);

    if (!result.ok) {
      if (result.reason === 'db_error') {
        return c.json({ error: 'Service unavailable' }, 503);
      }
      return c.json({ error: 'Account not found' }, 401);
    }

    return c.json(result.user, 200);
  });

  return router;
}
