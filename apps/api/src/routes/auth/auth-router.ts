import { Hono } from 'hono';
import type { Db } from '../../infrastructure/db';
import type { AppConfig } from '../../config';
import type { Logger } from '../../lib/logger';
import type { AppVariables } from '../../domain/auth/types';
import { createLoginRoute } from './login-route';
import { createMeRoute } from './me-route';

export interface AuthDeps {
  db: Db;
  config: Pick<AppConfig, 'JWT_SECRET'>;
  logger: Logger;
}

export function createAuthRouter(deps: AuthDeps): Hono<{ Variables: AppVariables }> {
  const router = new Hono<{ Variables: AppVariables }>();
  router.route('/', createLoginRoute(deps));
  router.route('/', createMeRoute(deps));
  return router;
}
