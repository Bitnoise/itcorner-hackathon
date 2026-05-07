import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { requireRole } from './require-auth';
import type { AppVariables, UserRole } from '../domain/auth/types';
import type { Logger } from '../lib/logger';

function makeLogger(): Logger & { warns: Array<[string, unknown?]> } {
  const warns: Array<[string, unknown?]> = [];
  return {
    info: () => {},
    warn: (event: string, ctx?: unknown) => warns.push([event, ctx]),
    error: () => {},
    debug: () => {},
    warns,
  };
}

function makeApp(
  contextRole: string,
  contextUserId: string,
  allowedRoles: unknown[],
  logger: Logger,
) {
  const app = new Hono<{ Variables: AppVariables }>();
  app.get('/test', async (c, next) => {
    c.set('userId', contextUserId);
    c.set('userRole', contextRole as UserRole);
    await next();
  });
  app.get('/test', requireRole(allowedRoles as UserRole[], { logger }), (c) =>
    c.json({ ok: true }),
  );
  return app;
}

describe('requireRole middleware', () => {
  it('allows a doctor when role is doctor', async () => {
    const logger = makeLogger();
    const app = makeApp('doctor', 'uid-1', ['doctor'], logger);
    const res = await app.request('/test');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('returns 403 when patient hits a doctor-only route', async () => {
    const logger = makeLogger();
    const app = makeApp('patient', 'uid-2', ['doctor'], logger);
    const res = await app.request('/test');
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Forbidden' });
  });

  it('allows a patient when role is patient', async () => {
    const logger = makeLogger();
    const app = makeApp('patient', 'uid-3', ['patient'], logger);
    const res = await app.request('/test');
    expect(res.status).toBe(200);
  });

  it('returns 403 when doctor hits a patient-only route', async () => {
    const logger = makeLogger();
    const app = makeApp('doctor', 'uid-4', ['patient'], logger);
    const res = await app.request('/test');
    expect(res.status).toBe(403);
  });

  it('logs auth.rbac.denied with user_id, role, and path on 403', async () => {
    const logger = makeLogger();
    const app = makeApp('patient', 'uid-5', ['doctor'], logger);
    await app.request('/test');
    expect(logger.warns).toHaveLength(1);
    const [event, ctx] = logger.warns[0]!;
    expect(event).toBe('auth.rbac.denied');
    expect(ctx).toMatchObject({ user_id: 'uid-5', role: 'patient', path: '/test' });
  });

  it('rejects a junk role even when it appears in allowedRoles (defense-in-depth)', async () => {
    const logger = makeLogger();
    const app = makeApp('admin', 'uid-6', ['admin', 'doctor', 'patient'], logger);
    const res = await app.request('/test');
    expect(res.status).toBe(403);
  });
});
