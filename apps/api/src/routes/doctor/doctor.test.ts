import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { tmpdir } from 'node:os';
import { createApp } from '../../app';
import { createDb } from '../../infrastructure/db';
import { createLogger } from '../../lib/logger';
import { signJwt } from '../../lib/jwt';
import { users, doctors, patients } from '../../db/schema';

const DATABASE_URL = process.env['DATABASE_URL'];
const JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long';
const TEST_CONFIG = { JWT_SECRET, DOCUMENT_STORAGE_PATH: tmpdir() };

const describeWithDb = DATABASE_URL ? describe : describe.skip;

describeWithDb('Doctor profile routes (integration)', () => {
  const db = createDb(DATABASE_URL!);
  const logger = createLogger({ sink: () => {} });

  let doctorUserId: string;
  let doctorToken: string;
  let patientUserId: string;
  let _patientToken: string;

  beforeAll(async () => {
    await db.delete(users).where(eq(users.email, 'doc.profile.doctor@example.com'));
    await db.delete(users).where(eq(users.email, 'doc.profile.patient@example.com'));

    const hash = await bcrypt.hash('password', 4);

    const [docUser] = await db
      .insert(users)
      .values({
        email: 'doc.profile.doctor@example.com',
        passwordHash: hash,
        role: 'doctor',
      })
      .returning();
    doctorUserId = docUser!.id;
    doctorToken = signJwt({ sub: doctorUserId, role: 'doctor' }, JWT_SECRET);
    await db.insert(doctors).values({
      userId: doctorUserId,
      firstName: 'Greg',
      lastName: 'House',
    });

    const [patUser] = await db
      .insert(users)
      .values({
        email: 'doc.profile.patient@example.com',
        passwordHash: hash,
        role: 'patient',
      })
      .returning();
    patientUserId = patUser!.id;
    _patientToken = signJwt({ sub: patientUserId, role: 'patient' }, JWT_SECRET);
    await db.insert(patients).values({
      userId: patientUserId,
      firstName: 'Lisa',
      lastName: 'Cuddy',
    });
  });

  afterAll(async () => {
    await db.delete(users).where(eq(users.id, doctorUserId));
    await db.delete(users).where(eq(users.id, patientUserId));
  });

  function makeApp() {
    return createApp({ db, config: TEST_CONFIG, logger });
  }

  describe('GET /doctors/me/profile', () => {
    it('returns 200 with the calling doctor profile (specialization may be null)', async () => {
      const app = makeApp();
      const res = await app.request('/doctors/me/profile', {
        headers: { Authorization: `Bearer ${doctorToken}` },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        userId: string;
        firstName: string;
        lastName: string;
        specialization: string | null;
      };
      expect(body.userId).toBe(doctorUserId);
      expect(body.firstName).toBe('Greg');
      expect(body.lastName).toBe('House');
      expect(body.specialization === null || typeof body.specialization === 'string').toBe(true);
    });
  });

  describe('PATCH /doctors/me/profile', () => {
    it('updates only specialization when only specialization is provided', async () => {
      const app = makeApp();
      const res = await app.request('/doctors/me/profile', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${doctorToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ specialization: 'Cardiology' }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        userId: string;
        firstName: string;
        lastName: string;
        specialization: string | null;
      };
      expect(body.userId).toBe(doctorUserId);
      expect(body.firstName).toBe('Greg');
      expect(body.lastName).toBe('House');
      expect(body.specialization).toBe('Cardiology');
    });

    it('returns the current profile unchanged when the body is empty ({})', async () => {
      const app = makeApp();
      const before = await app.request('/doctors/me/profile', {
        headers: { Authorization: `Bearer ${doctorToken}` },
      });
      const beforeBody = (await before.json()) as {
        firstName: string;
        lastName: string;
        specialization: string | null;
      };

      const res = await app.request('/doctors/me/profile', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${doctorToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        firstName: string;
        lastName: string;
        specialization: string | null;
      };
      expect(body.firstName).toBe(beforeBody.firstName);
      expect(body.lastName).toBe(beforeBody.lastName);
      expect(body.specialization).toBe(beforeBody.specialization);
    });

    it('does NOT emit doctor.profile.updated for an empty-body PATCH', async () => {
      const logLines: string[] = [];
      const capLogger = createLogger({ sink: (line) => logLines.push(line) });
      const capApp = createApp({ db, config: TEST_CONFIG, logger: capLogger });
      await capApp.request('/doctors/me/profile', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${doctorToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      const events = logLines.map((l) => JSON.parse(l) as { event: string });
      expect(events.some((e) => e.event === 'doctor.profile.updated')).toBe(false);
    });

    it('updates first/last/specialization together and bumps updated_at', async () => {
      const beforeRow = (
        await db.select().from(doctors).where(eq(doctors.userId, doctorUserId)).limit(1)
      )[0];
      expect(beforeRow).toBeDefined();
      const beforeUpdatedAt = beforeRow!.updatedAt.getTime();

      // Force a measurable gap so updated_at changes by more than the test runtime jitter.
      await new Promise((r) => setTimeout(r, 20));

      const app = makeApp();
      const res = await app.request('/doctors/me/profile', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${doctorToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: 'Gregory',
          lastName: 'M. House',
          specialization: 'Diagnostic Medicine',
        }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        firstName: string;
        lastName: string;
        specialization: string | null;
      };
      expect(body.firstName).toBe('Gregory');
      expect(body.lastName).toBe('M. House');
      expect(body.specialization).toBe('Diagnostic Medicine');

      const afterRow = (
        await db.select().from(doctors).where(eq(doctors.userId, doctorUserId)).limit(1)
      )[0];
      expect(afterRow!.updatedAt.getTime()).toBeGreaterThan(beforeUpdatedAt);
    });

    it('emits doctor.profile.updated with the changed field names (no values)', async () => {
      const logLines: string[] = [];
      const capLogger = createLogger({ sink: (line) => logLines.push(line) });
      const capApp = createApp({ db, config: TEST_CONFIG, logger: capLogger });
      await capApp.request('/doctors/me/profile', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${doctorToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ specialization: 'Neurology' }),
      });
      const events = logLines.map((l) =>
        JSON.parse(l) as { event: string; userId?: string; fields?: string[] },
      );
      const updated = events.find((e) => e.event === 'doctor.profile.updated');
      expect(updated).toBeDefined();
      expect(updated?.userId).toBe(doctorUserId);
      expect(updated?.fields).toEqual(['specialization']);
      // The PII rule: the value must never appear in any log line.
      const allOutput = logLines.join('');
      expect(allOutput).not.toContain('Neurology');
    });
  });
});
