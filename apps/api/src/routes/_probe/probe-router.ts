import { Hono } from 'hono';
import type { AppConfig } from '../../config';
import type { Logger } from '../../lib/logger';
import type { AppVariables } from '../../domain/auth/types';
import { requireAuth, requireRole } from '../../middleware/require-auth';

export interface ProbeDeps {
  config: Pick<AppConfig, 'JWT_SECRET'>;
  logger: Logger;
}

export function createProbeRouter(deps: ProbeDeps): Hono<{ Variables: AppVariables }> {
  const router = new Hono<{ Variables: AppVariables }>();

  router.get(
    '/doctor-only',
    requireAuth(deps),
    requireRole(['doctor'], deps),
    (c) => c.json({ ok: true as const }),
  );

  router.get(
    '/patient-only',
    requireAuth(deps),
    requireRole(['patient'], deps),
    (c) => c.json({ ok: true as const }),
  );

  return router;
}
