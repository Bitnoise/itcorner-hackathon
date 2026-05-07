import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { createApp } from '../../app';
import { createDb } from '../../infrastructure/db';
import { createLogger } from '../../lib/logger';
import { signJwt } from '../../lib/jwt';
import { users, patients } from '../../db/schema';

const DATABASE_URL = process.env['DATABASE_URL'];
const JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long';
const OTHER_SECRET = 'other-secret-that-is-at-least-32-chars-long';

const describeWithDb = DATABASE_URL ? describe : describe.skip;

describeWithDb('Auth routes (integration)', () => {
  const db = createDb(DATABASE_URL!);
  const logger = createLogger({ sink: () => {} });
  const app = createApp({ db, config: { JWT_SECRET }, logger });

  let testUserId: string;

  beforeAll(async () => {
    const hash = await bcrypt.hash('correct-password', 4);
    const [user] = await db
      .insert(users)
      .values({
        email: 'test.auth@example.com',
        passwordHash: hash,
        role: 'patient',
      })
      .returning();
    testUserId = user!.id;
    await db.insert(patients).values({
      userId: testUserId,
      firstName: 'Test',
      lastName: 'User',
    });
  });

  afterAll(async () => {
    await db.delete(users).where(eq(users.id, testUserId));
  });

  describe('POST /auth/login', () => {
    it('returns 200 with a JWT token for valid credentials', async () => {
      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test.auth@example.com', password: 'correct-password' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json() as { token: string };
      expect(typeof body.token).toBe('string');
      expect(body.token.split('.')).toHaveLength(3);
    });

    it('returns 401 for wrong password', async () => {
      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test.auth@example.com', password: 'wrong-password' }),
      });

      expect(res.status).toBe(401);
      const body = await res.json() as { error: string };
      expect(body.error).toBe('Invalid credentials');
    });

    it('returns 401 for unknown email', async () => {
      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'nobody@example.com', password: 'any-password' }),
      });

      expect(res.status).toBe(401);
    });

    it('returns 422 for invalid body (missing password)', async () => {
      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test.auth@example.com' }),
      });

      expect(res.status).toBe(422);
      const body = await res.json() as { error: string };
      expect(body.error).toBe('Validation failed');
    });

    it('returns 422 listing both email and password issues for invalid email and empty password', async () => {
      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-an-email', password: '' }),
      });

      expect(res.status).toBe(422);
      const body = await res.json() as { error: string; issues: Array<{ path: unknown[] }> };
      expect(body.error).toBe('Validation failed');
      const paths = body.issues.map((i) => i.path[0]);
      expect(paths).toContain('email');
      expect(paths).toContain('password');
    });

    it('returns 415 for non-JSON content type', async () => {
      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'email=test&password=test',
      });

      expect(res.status).toBe(415);
      const body = await res.json() as { error: string };
      expect(body.error).toBe('Unsupported Media Type');
    });

    it('returns 503 when the database is unreachable', async () => {
      const brokenDb = createDb('postgresql://bad:bad@localhost:9999/notexist');
      const brokenApp = createApp({ db: brokenDb, config: { JWT_SECRET }, logger });

      const res = await brokenApp.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', password: 'password' }),
      });

      expect(res.status).toBe(503);
      const body = await res.json() as { error: string };
      expect(body.error).toBe('Service unavailable');
    });
  });

  describe('GET /auth/me', () => {
    let validToken: string;

    beforeAll(async () => {
      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test.auth@example.com', password: 'correct-password' }),
      });
      const body = await res.json() as { token: string };
      validToken = body.token;
    });

    it('returns 200 with user data for a valid token', async () => {
      const res = await app.request('/auth/me', {
        headers: { Authorization: `Bearer ${validToken}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json() as { id: string; email: string; role: string; firstName: string; lastName: string };
      expect(body.id).toBe(testUserId);
      expect(body.email).toBe('test.auth@example.com');
      expect(body.role).toBe('patient');
      expect(body.firstName).toBe('Test');
      expect(body.lastName).toBe('User');
    });

    it('returns 401 without Authorization header', async () => {
      const res = await app.request('/auth/me');
      expect(res.status).toBe(401);
      const body = await res.json() as { error: string };
      expect(body.error).toBe('Authorization header required');
    });

    it('returns 401 with wrong scheme (not Bearer)', async () => {
      const res = await app.request('/auth/me', {
        headers: { Authorization: 'Token abc123' },
      });
      expect(res.status).toBe(401);
      const body = await res.json() as { error: string };
      expect(body.error).toBe('Malformed Authorization header');
    });

    it('returns 401 with empty bearer token ("Bearer ")', async () => {
      const res = await app.request('/auth/me', {
        headers: { Authorization: 'Bearer ' },
      });
      expect(res.status).toBe(401);
      const body = await res.json() as { error: string };
      expect(body.error).toBe('Malformed Authorization header');
    });

    it('returns 401 with double-space bearer token ("Bearer  abc")', async () => {
      const res = await app.request('/auth/me', {
        headers: { Authorization: 'Bearer  abc' },
      });
      expect(res.status).toBe(401);
      const body = await res.json() as { error: string };
      expect(body.error).toBe('Malformed Authorization header');
    });

    it('returns 401 with an expired token', async () => {
      const expiredToken = signJwt({ sub: testUserId, role: 'patient' }, JWT_SECRET, -1);
      const res = await app.request('/auth/me', {
        headers: { Authorization: `Bearer ${expiredToken}` },
      });
      expect(res.status).toBe(401);
      const body = await res.json() as { error: string };
      expect(body.error).toBe('Token expired');
    });

    it('returns 401 with a tampered token signature', async () => {
      const parts = validToken.split('.');
      const tampered = `${parts[0]}.${parts[1]}.tampered_sig_xyz`;
      const res = await app.request('/auth/me', {
        headers: { Authorization: `Bearer ${tampered}` },
      });
      expect(res.status).toBe(401);
      const body = await res.json() as { error: string };
      expect(body.error).toBe('Invalid token');
    });

    it('returns 401 for a JWT signed with a different secret', async () => {
      const otherToken = signJwt({ sub: testUserId, role: 'patient' }, OTHER_SECRET);
      const res = await app.request('/auth/me', {
        headers: { Authorization: `Bearer ${otherToken}` },
      });
      expect(res.status).toBe(401);
      const body = await res.json() as { error: string };
      expect(body.error).toBe('Invalid token');
    });

    it('returns 401 with { error: "Account not found" } when JWT sub is deleted from users', async () => {
      const hash = await bcrypt.hash('temp-password', 4);
      const [tempUser] = await db
        .insert(users)
        .values({ email: 'temp.deleted@example.com', passwordHash: hash, role: 'patient' })
        .returning();
      const tempToken = signJwt({ sub: tempUser!.id, role: 'patient' }, JWT_SECRET);
      await db.delete(users).where(eq(users.id, tempUser!.id));

      const res = await app.request('/auth/me', {
        headers: { Authorization: `Bearer ${tempToken}` },
      });
      expect(res.status).toBe(401);
      const body = await res.json() as { error: string };
      expect(body.error).toBe('Account not found');
    });
  });

  describe('Structured log events', () => {
    it('emits auth.login.success with userId and role on successful login', async () => {
      const logLines: string[] = [];
      const capLogger = createLogger({ sink: (line) => logLines.push(line) });
      const capApp = createApp({ db, config: { JWT_SECRET }, logger: capLogger });

      await capApp.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test.auth@example.com', password: 'correct-password' }),
      });

      const events = logLines.map((l) => JSON.parse(l) as { event: string; userId?: string; role?: string });
      const success = events.find((e) => e.event === 'auth.login.success');
      expect(success).toBeDefined();
      expect(typeof success?.userId).toBe('string');
      expect(success?.role).toBe('patient');
    });

    it('emits auth.login.failed without plaintext email on wrong credentials', async () => {
      const logLines: string[] = [];
      const capLogger = createLogger({ sink: (line) => logLines.push(line) });
      const capApp = createApp({ db, config: { JWT_SECRET }, logger: capLogger });

      await capApp.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test.auth@example.com', password: 'wrong-password' }),
      });

      const allOutput = logLines.join('');
      const events = logLines.map((l) => JSON.parse(l) as { event: string });
      expect(events.some((e) => e.event === 'auth.login.failed')).toBe(true);
      expect(allOutput).not.toContain('test.auth@example.com');
    });

    it('emits auth.token.expired when an expired token is used', async () => {
      const logLines: string[] = [];
      const capLogger = createLogger({ sink: (line) => logLines.push(line) });
      const capApp = createApp({ db, config: { JWT_SECRET }, logger: capLogger });
      const expiredToken = signJwt({ sub: testUserId, role: 'patient' }, JWT_SECRET, -1);

      await capApp.request('/auth/me', {
        headers: { Authorization: `Bearer ${expiredToken}` },
      });

      const events = logLines.map((l) => JSON.parse(l) as { event: string });
      expect(events.some((e) => e.event === 'auth.token.expired')).toBe(true);
    });

    it('emits auth.token.invalid when a tampered token is used', async () => {
      const logLines: string[] = [];
      const capLogger = createLogger({ sink: (line) => logLines.push(line) });
      const capApp = createApp({ db, config: { JWT_SECRET }, logger: capLogger });

      await capApp.request('/auth/me', {
        headers: { Authorization: 'Bearer header.payload.tampered' },
      });

      const events = logLines.map((l) => JSON.parse(l) as { event: string });
      expect(events.some((e) => e.event === 'auth.token.invalid')).toBe(true);
    });
  });
});
