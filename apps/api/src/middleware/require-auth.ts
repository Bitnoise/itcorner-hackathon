import type { MiddlewareHandler } from 'hono';
import { verifyJwt } from '../lib/jwt';
import type { AppConfig } from '../config';
import type { Logger } from '../lib/logger';
import type { AppVariables, UserRole } from '../domain/auth/types';

type Env = { Variables: AppVariables };

export function requireAuth(deps: {
  config: Pick<AppConfig, 'JWT_SECRET'>;
  logger: Logger;
}): MiddlewareHandler<Env> {
  return async (c, next) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader) {
      return c.json({ error: 'Authorization header required' }, 401);
    }

    if (!authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Malformed Authorization header' }, 401);
    }

    const token = authHeader.slice(7);
    if (!token || token[0] === ' ') {
      return c.json({ error: 'Malformed Authorization header' }, 401);
    }
    const result = verifyJwt(token, deps.config.JWT_SECRET);

    if (!result.ok) {
      deps.logger.warn(result.reason === 'expired' ? 'auth.token.expired' : 'auth.token.invalid');
      const error = result.reason === 'expired' ? 'Token expired' : 'Invalid token';
      return c.json({ error }, 401);
    }

    c.set('userId', result.payload.sub);
    c.set('userRole', result.payload.role);
    await next();
  };
}

export function requireRole(
  roles: UserRole[],
  deps: { logger: Logger },
): MiddlewareHandler<Env> {
  return async (c, next) => {
    const role = c.get('userRole');
    if (!role || !roles.includes(role)) {
      deps.logger.warn('auth.rbac.denied', { role, requiredRoles: roles });
      return c.json({ error: 'Forbidden' }, 403);
    }
    await next();
  };
}
