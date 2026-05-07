import { Hono } from 'hono';
import { updateDoctorProfileBodySchema } from '@medbridge/contracts/doctor';
import type { Db } from '../../infrastructure/db';
import type { AppConfig } from '../../config';
import type { Logger } from '../../lib/logger';
import type { AppVariables } from '../../domain/auth/types';
import { requireAuth, requireRole } from '../../middleware/require-auth';
import { getDoctorProfile } from '../../use-cases/doctor/get-profile';
import { updateProfile } from '../../use-cases/doctor/update-profile';

export interface DoctorDeps {
  db: Db;
  config: Pick<AppConfig, 'JWT_SECRET'>;
  logger: Logger;
}

export function createDoctorRouter(deps: DoctorDeps): Hono<{ Variables: AppVariables }> {
  const router = new Hono<{ Variables: AppVariables }>();

  router.get(
    '/doctors/me/profile',
    requireAuth(deps),
    requireRole(['doctor'], deps),
    async (c) => {
      const userId = c.get('userId');
      const result = await getDoctorProfile(userId, { db: deps.db });
      if (!result.ok) {
        return c.json({ error: 'PROFILE_NOT_FOUND' }, 404);
      }
      return c.json(result.profile, 200);
    },
  );

  router.patch(
    '/doctors/me/profile',
    requireAuth(deps),
    requireRole(['doctor'], deps),
    async (c) => {
      const userId = c.get('userId');
      const raw = await c.req.json().catch(() => null);
      if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
        return c.json({ error: 'Validation failed' }, 422);
      }
      const parsed = updateDoctorProfileBodySchema.safeParse(raw);
      if (!parsed.success) {
        return c.json({ error: 'Validation failed' }, 422);
      }
      const result = await updateProfile(userId, parsed.data, {
        db: deps.db,
        logger: deps.logger,
      });
      if (!result.ok) {
        return c.json({ error: 'PROFILE_NOT_FOUND' }, 404);
      }
      return c.json(result.profile, 200);
    },
  );

  return router;
}
