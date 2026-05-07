import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { createApp } from '../../app';
import { createDb } from '../../infrastructure/db';
import { createLogger } from '../../lib/logger';
import { users, patients } from '../../db/schema';

const DATABASE_URL = process.env['DATABASE_URL'];
const JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long';

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

    it('returns 415 for non-JSON content type', async () => {
      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'email=test&password=test',
      });

      expect(res.status).toBe(415);
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
    });

    it('returns 401 with a malformed Authorization header', async () => {
      const res = await app.request('/auth/me', {
        headers: { Authorization: 'NotBearer token' },
      });

      expect(res.status).toBe(401);
    });

    it('returns 401 with an invalid token', async () => {
      const res = await app.request('/auth/me', {
        headers: { Authorization: 'Bearer invalid.token.value' },
      });

      expect(res.status).toBe(401);
    });
  });
});
