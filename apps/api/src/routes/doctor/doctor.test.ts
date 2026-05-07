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
  let patientToken: string;

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
    patientToken = signJwt({ sub: patientUserId, role: 'patient' }, JWT_SECRET);
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
});
