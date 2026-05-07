import { describe, it, expect } from 'vitest';
import { signJwt } from '../../lib/jwt';
import { createProbeRouter } from './probe-router';

const SECRET = 'test-secret-that-is-at-least-32-chars-long';

function makeLogger() {
  return { info: () => {}, warn: () => {}, error: () => {} };
}

function makeRouter() {
  return createProbeRouter({ config: { JWT_SECRET: SECRET }, logger: makeLogger() });
}

function authHeader(role: 'doctor' | 'patient') {
  return { Authorization: `Bearer ${signJwt({ sub: 'uid-probe', role }, SECRET)}` };
}

describe('GET /doctor-only probe route', () => {
  it('returns 200 { ok: true } for a doctor', async () => {
    const router = makeRouter();
    const res = await router.request('/doctor-only', { headers: authHeader('doctor') });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('returns 403 for a patient', async () => {
    const router = makeRouter();
    const res = await router.request('/doctor-only', { headers: authHeader('patient') });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Forbidden' });
  });

  it('returns 401 with no token', async () => {
    const router = makeRouter();
    const res = await router.request('/doctor-only');
    expect(res.status).toBe(401);
  });
});

describe('GET /patient-only probe route', () => {
  it('returns 200 { ok: true } for a patient', async () => {
    const router = makeRouter();
    const res = await router.request('/patient-only', { headers: authHeader('patient') });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('returns 403 for a doctor', async () => {
    const router = makeRouter();
    const res = await router.request('/patient-only', { headers: authHeader('doctor') });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Forbidden' });
  });
});
