import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { and, eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { createApp } from '../../app';
import { createDb } from '../../infrastructure/db';
import { createLogger } from '../../lib/logger';
import { signJwt } from '../../lib/jwt';
import { users, documents, doctors, patients, documentShares } from '../../db/schema';

const DATABASE_URL = process.env['DATABASE_URL'];
const JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long';

const describeWithDb = DATABASE_URL ? describe : describe.skip;

describeWithDb('Documents routes (integration)', () => {
  const db = createDb(DATABASE_URL!);
  const logger = createLogger({ sink: () => {} });
  let tmpDir: string;

  let patientUserId: string;
  let doctorUserId: string;
  let patientToken: string;
  let doctorToken: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'doc-routes-test-'));

    // Clean up any leftover test users from previous runs
    await db.delete(users).where(eq(users.email, 'doc.patient@example.com'));
    await db.delete(users).where(eq(users.email, 'doc.doctor@example.com'));
    await db.delete(users).where(eq(users.email, 'doc.empty@example.com'));

    const hash = await bcrypt.hash('password', 4);

    const [patientUser] = await db
      .insert(users)
      .values({ email: 'doc.patient@example.com', passwordHash: hash, role: 'patient' })
      .returning();
    patientUserId = patientUser!.id;
    patientToken = signJwt({ sub: patientUserId, role: 'patient' }, JWT_SECRET);

    const [doctorUser] = await db
      .insert(users)
      .values({ email: 'doc.doctor@example.com', passwordHash: hash, role: 'doctor' })
      .returning();
    doctorUserId = doctorUser!.id;
    doctorToken = signJwt({ sub: doctorUserId, role: 'doctor' }, JWT_SECRET);
  });

  afterAll(async () => {
    await db.delete(documents).where(eq(documents.patientId, patientUserId));
    await db.delete(users).where(eq(users.id, patientUserId));
    await db.delete(users).where(eq(users.id, doctorUserId));
    await rm(tmpDir, { recursive: true, force: true });
  });

  function makeApp() {
    return createApp({
      db,
      config: {
        JWT_SECRET,
        DOCUMENT_STORAGE_PATH: tmpDir,
      },
      logger,
    });
  }

  function makePdfFormData(filename = 'test.pdf', sizeBytes = 1024): FormData {
    const bytes = new Uint8Array(sizeBytes);
    // PDF magic bytes
    bytes[0] = 0x25; // %
    bytes[1] = 0x50; // P
    bytes[2] = 0x44; // D
    bytes[3] = 0x46; // F
    const file = new File([bytes], filename, { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', file);
    return formData;
  }

  // AC 1: POST /documents with valid PDF <= 10 MiB returns 201
  describe('AC 1: POST /documents with valid PDF', () => {
    it('returns 201 with document metadata', async () => {
      const app = makeApp();
      const formData = makePdfFormData('my-report.pdf', 1024);

      const res = await app.request('/documents', {
        method: 'POST',
        headers: { Authorization: `Bearer ${patientToken}` },
        body: formData,
      });

      expect(res.status).toBe(201);
      const body = await res.json() as {
        id: string;
        filename: string;
        mimeType: string;
        size: number;
        uploadedAt: string;
      };
      expect(body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(body.filename).toBe('my-report.pdf');
      expect(body.mimeType).toBe('application/pdf');
      expect(body.size).toBe(1024);
      expect(typeof body.uploadedAt).toBe('string');
    });

    it('saves a UUID-named file to disk', async () => {
      const app = makeApp();
      const formData = makePdfFormData('disk-test.pdf', 512);

      // Record files before upload
      const filesBefore = await readdir(tmpDir);

      const res = await app.request('/documents', {
        method: 'POST',
        headers: { Authorization: `Bearer ${patientToken}` },
        body: formData,
      });
      expect(res.status).toBe(201);

      // A new UUID-named file should have been created
      const filesAfter = await readdir(tmpDir);
      const newFiles = filesAfter.filter((f) => !filesBefore.includes(f));
      expect(newFiles).toHaveLength(1);
      expect(newFiles[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });
  });

  // AC 2: POST /documents with file > 10 MiB returns 413
  describe('AC 2: POST /documents with file > 10 MiB', () => {
    it('returns 413 with FILE_TOO_LARGE', async () => {
      const app = makeApp();
      // 10 MiB + 1 byte = 10485761 bytes
      const oversizeBytes = 10 * 1024 * 1024 + 1;
      const bytes = new Uint8Array(oversizeBytes);
      const file = new File([bytes], 'huge.pdf', { type: 'application/pdf' });
      const formData = new FormData();
      formData.append('file', file);

      const res = await app.request('/documents', {
        method: 'POST',
        headers: { Authorization: `Bearer ${patientToken}` },
        body: formData,
      });

      expect(res.status).toBe(413);
      const body = await res.json() as { error: string };
      expect(body.error).toBe('FILE_TOO_LARGE');
    });
  });

  // AC 3: POST /documents with disallowed MIME type returns 415
  describe('AC 3: POST /documents with disallowed MIME type', () => {
    it('returns 415 with UNSUPPORTED_MEDIA_TYPE for text/plain', async () => {
      const app = makeApp();
      const file = new File(['hello'], 'test.txt', { type: 'text/plain' });
      const formData = new FormData();
      formData.append('file', file);

      const res = await app.request('/documents', {
        method: 'POST',
        headers: { Authorization: `Bearer ${patientToken}` },
        body: formData,
      });

      expect(res.status).toBe(415);
      const body = await res.json() as { error: string };
      expect(body.error).toBe('UNSUPPORTED_MEDIA_TYPE');
    });

    it('returns 415 for image/gif', async () => {
      const app = makeApp();
      const file = new File([new Uint8Array(100)], 'anim.gif', { type: 'image/gif' });
      const formData = new FormData();
      formData.append('file', file);

      const res = await app.request('/documents', {
        method: 'POST',
        headers: { Authorization: `Bearer ${patientToken}` },
        body: formData,
      });

      expect(res.status).toBe(415);
    });
  });

  // AC 4: POST /documents with no file returns 422
  describe('AC 4: POST /documents with no file', () => {
    it('returns 422 with MISSING_FILE', async () => {
      const app = makeApp();
      const formData = new FormData();
      formData.append('other', 'value');

      const res = await app.request('/documents', {
        method: 'POST',
        headers: { Authorization: `Bearer ${patientToken}` },
        body: formData,
      });

      expect(res.status).toBe(422);
      const body = await res.json() as { error: string };
      expect(body.error).toBe('MISSING_FILE');
    });
  });

  // AC 5: GET /documents returns list
  describe('AC 5: GET /documents', () => {
    it('returns 200 with empty array when no documents', async () => {
      // Create a fresh user with no docs (clean up first if exists)
      const hash = await bcrypt.hash('password', 4);
      await db.delete(users).where(eq(users.email, 'doc.empty@example.com'));
      const [freshUser] = await db
        .insert(users)
        .values({ email: 'doc.empty@example.com', passwordHash: hash, role: 'patient' })
        .returning();
      const freshToken = signJwt({ sub: freshUser!.id, role: 'patient' }, JWT_SECRET);

      const app = makeApp();
      const res = await app.request('/documents', {
        headers: { Authorization: `Bearer ${freshToken}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json() as unknown[];
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(0);

      await db.delete(users).where(eq(users.id, freshUser!.id));
    });

    it('returns 200 with docs ordered by uploadedAt desc', async () => {
      // Upload two docs via the API so they get inserted
      const app = makeApp();

      const form1 = makePdfFormData('first.pdf', 100);
      const res1 = await app.request('/documents', {
        method: 'POST',
        headers: { Authorization: `Bearer ${patientToken}` },
        body: form1,
      });
      expect(res1.status).toBe(201);

      // Small delay to ensure different timestamps
      await new Promise((r) => setTimeout(r, 10));

      const form2 = makePdfFormData('second.pdf', 200);
      const res2 = await app.request('/documents', {
        method: 'POST',
        headers: { Authorization: `Bearer ${patientToken}` },
        body: form2,
      });
      expect(res2.status).toBe(201);

      const listRes = await app.request('/documents', {
        headers: { Authorization: `Bearer ${patientToken}` },
      });

      expect(listRes.status).toBe(200);
      const body = await listRes.json() as Array<{ filename: string; uploadedAt: string }>;
      expect(body.length).toBeGreaterThanOrEqual(2);

      // Most recent first
      const timestamps = body.map((d) => new Date(d.uploadedAt).getTime());
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i - 1]).toBeGreaterThanOrEqual(timestamps[i]!);
      }
    });
  });

  // AC 6: Auth/role checks
  describe('AC 6: Authentication and authorization', () => {
    it('POST /documents returns 401 without JWT', async () => {
      const app = makeApp();
      const formData = makePdfFormData();

      const res = await app.request('/documents', {
        method: 'POST',
        body: formData,
      });

      expect(res.status).toBe(401);
    });

    it('GET /documents returns 401 without JWT', async () => {
      const app = makeApp();
      const res = await app.request('/documents');
      expect(res.status).toBe(401);
    });

    it('POST /documents returns 403 with doctor JWT', async () => {
      const app = makeApp();
      const formData = makePdfFormData();

      const res = await app.request('/documents', {
        method: 'POST',
        headers: { Authorization: `Bearer ${doctorToken}` },
        body: formData,
      });

      expect(res.status).toBe(403);
    });

    it('GET /documents returns 403 with doctor JWT', async () => {
      const app = makeApp();

      const res = await app.request('/documents', {
        headers: { Authorization: `Bearer ${doctorToken}` },
      });

      expect(res.status).toBe(403);
    });
  });
});

describeWithDb('Document sharing routes (integration)', () => {
  const db = createDb(DATABASE_URL!);
  const logger = createLogger({ sink: () => {} });
  let tmpDir: string;

  let patientAId: string;
  let patientBId: string;
  let doctorOneId: string;
  let doctorTwoId: string;
  let patientAToken: string;
  let doctorOneToken: string;

  let docByPatientA: string;
  let docByPatientB: string;

  async function cleanupUsers() {
    for (const email of [
      'share.patient.a@example.com',
      'share.patient.b@example.com',
      'share.doctor.one@example.com',
      'share.doctor.two@example.com',
    ]) {
      await db.delete(users).where(eq(users.email, email));
    }
  }

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'doc-share-test-'));
    await cleanupUsers();

    const hash = await bcrypt.hash('password', 4);

    const [pA] = await db
      .insert(users)
      .values({ email: 'share.patient.a@example.com', passwordHash: hash, role: 'patient' })
      .returning();
    patientAId = pA!.id;
    await db.insert(patients).values({ userId: patientAId, firstName: 'Alice', lastName: 'Anders' });
    patientAToken = signJwt({ sub: patientAId, role: 'patient' }, JWT_SECRET);

    const [pB] = await db
      .insert(users)
      .values({ email: 'share.patient.b@example.com', passwordHash: hash, role: 'patient' })
      .returning();
    patientBId = pB!.id;
    await db.insert(patients).values({ userId: patientBId, firstName: 'Bob', lastName: 'Brown' });

    const [d1] = await db
      .insert(users)
      .values({ email: 'share.doctor.one@example.com', passwordHash: hash, role: 'doctor' })
      .returning();
    doctorOneId = d1!.id;
    await db.insert(doctors).values({ userId: doctorOneId, firstName: 'Dora', lastName: 'Onealf' });
    doctorOneToken = signJwt({ sub: doctorOneId, role: 'doctor' }, JWT_SECRET);

    const [d2] = await db
      .insert(users)
      .values({ email: 'share.doctor.two@example.com', passwordHash: hash, role: 'doctor' })
      .returning();
    doctorTwoId = d2!.id;
    await db.insert(doctors).values({ userId: doctorTwoId, firstName: 'Diane', lastName: 'Twostein' });

    const [docA] = await db
      .insert(documents)
      .values({
        patientId: patientAId,
        filename: 'a-report.pdf',
        mimeType: 'application/pdf',
        size: 100,
        storagePath: '/dev/null/a-report',
      })
      .returning();
    docByPatientA = docA!.id;

    const [docB] = await db
      .insert(documents)
      .values({
        patientId: patientBId,
        filename: 'b-report.pdf',
        mimeType: 'application/pdf',
        size: 100,
        storagePath: '/dev/null/b-report',
      })
      .returning();
    docByPatientB = docB!.id;
  });

  afterAll(async () => {
    await cleanupUsers();
    await rm(tmpDir, { recursive: true, force: true });
  });

  function makeApp() {
    return createApp({
      db,
      config: { JWT_SECRET, DOCUMENT_STORAGE_PATH: tmpDir },
      logger,
    });
  }

  // Reset shares between tests so each starts from a known state
  async function clearSharesFor(documentId: string) {
    await db.delete(documentShares).where(eq(documentShares.documentId, documentId));
  }

  describe('GET /documents/:id/shares', () => {
    it('returns 200 with all doctors and hasAccess flags reflecting current state', async () => {
      await clearSharesFor(docByPatientA);
      // Pre-grant access to doctorOne, leave doctorTwo without
      await db.insert(documentShares).values({ documentId: docByPatientA, doctorId: doctorOneId });

      const app = makeApp();
      const res = await app.request(`/documents/${docByPatientA}/shares`, {
        headers: { Authorization: `Bearer ${patientAToken}` },
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as Array<{ doctorId: string; displayName: string; hasAccess: boolean }>;

      const byId = new Map(body.map((row) => [row.doctorId, row]));
      const one = byId.get(doctorOneId);
      const two = byId.get(doctorTwoId);
      expect(one).toBeDefined();
      expect(one?.hasAccess).toBe(true);
      expect(one?.displayName).toBe('Dora Onealf');
      expect(two).toBeDefined();
      expect(two?.hasAccess).toBe(false);
      expect(two?.displayName).toBe('Diane Twostein');
    });

    it('returns 404 DOCUMENT_NOT_FOUND for an unknown document id', async () => {
      const unknownId = '00000000-0000-4000-8000-000000000000';
      const app = makeApp();
      const res = await app.request(`/documents/${unknownId}/shares`, {
        headers: { Authorization: `Bearer ${patientAToken}` },
      });
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe('DOCUMENT_NOT_FOUND');
    });

    it('returns 403 when caller does not own the document', async () => {
      const app = makeApp();
      const res = await app.request(`/documents/${docByPatientB}/shares`, {
        headers: { Authorization: `Bearer ${patientAToken}` },
      });
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe('FORBIDDEN');
    });

    it('returns 401 without a JWT', async () => {
      const app = makeApp();
      const res = await app.request(`/documents/${docByPatientA}/shares`);
      expect(res.status).toBe(401);
    });

    it('returns 403 with a doctor JWT', async () => {
      const app = makeApp();
      const res = await app.request(`/documents/${docByPatientA}/shares`, {
        headers: { Authorization: `Bearer ${doctorOneToken}` },
      });
      expect(res.status).toBe(403);
    });
  });

  describe('PUT /documents/:id/shares/:doctorId', () => {
    it('grants access and returns 200; second call is idempotent (no duplicate row)', async () => {
      await clearSharesFor(docByPatientA);
      const app = makeApp();

      const res1 = await app.request(`/documents/${docByPatientA}/shares/${doctorOneId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${patientAToken}` },
      });
      expect(res1.status).toBe(200);

      const res2 = await app.request(`/documents/${docByPatientA}/shares/${doctorOneId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${patientAToken}` },
      });
      expect(res2.status).toBe(200);

      const rows = await db
        .select()
        .from(documentShares)
        .where(
          and(
            eq(documentShares.documentId, docByPatientA),
            eq(documentShares.doctorId, doctorOneId),
          ),
        );
      expect(rows).toHaveLength(1);
    });

    it('returns 404 DOCTOR_NOT_FOUND when the target user is not a doctor', async () => {
      const app = makeApp();
      // patientBId belongs to a patient, not a doctor
      const res = await app.request(`/documents/${docByPatientA}/shares/${patientBId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${patientAToken}` },
      });
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe('DOCTOR_NOT_FOUND');
    });

    it('returns 404 DOCUMENT_NOT_FOUND for an unknown document id', async () => {
      const unknownId = '00000000-0000-4000-8000-000000000001';
      const app = makeApp();
      const res = await app.request(`/documents/${unknownId}/shares/${doctorOneId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${patientAToken}` },
      });
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe('DOCUMENT_NOT_FOUND');
    });

    it('returns 403 when caller does not own the document', async () => {
      const app = makeApp();
      const res = await app.request(`/documents/${docByPatientB}/shares/${doctorOneId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${patientAToken}` },
      });
      expect(res.status).toBe(403);
    });

    it('returns 401 without a JWT', async () => {
      const app = makeApp();
      const res = await app.request(`/documents/${docByPatientA}/shares/${doctorOneId}`, {
        method: 'PUT',
      });
      expect(res.status).toBe(401);
    });

    it('returns 403 with a doctor JWT', async () => {
      const app = makeApp();
      const res = await app.request(`/documents/${docByPatientA}/shares/${doctorOneId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${doctorOneToken}` },
      });
      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /documents/:id/shares/:doctorId', () => {
    it('revokes access and returns 200; calling again with no existing share also returns 200 (idempotent)', async () => {
      await clearSharesFor(docByPatientA);
      await db.insert(documentShares).values({ documentId: docByPatientA, doctorId: doctorOneId });

      const app = makeApp();

      const res1 = await app.request(`/documents/${docByPatientA}/shares/${doctorOneId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${patientAToken}` },
      });
      expect(res1.status).toBe(200);

      const rows = await db
        .select()
        .from(documentShares)
        .where(
          and(
            eq(documentShares.documentId, docByPatientA),
            eq(documentShares.doctorId, doctorOneId),
          ),
        );
      expect(rows).toHaveLength(0);

      const res2 = await app.request(`/documents/${docByPatientA}/shares/${doctorOneId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${patientAToken}` },
      });
      expect(res2.status).toBe(200);
    });

    it('returns 404 DOCTOR_NOT_FOUND when the target user is not a doctor', async () => {
      const app = makeApp();
      const res = await app.request(`/documents/${docByPatientA}/shares/${patientBId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${patientAToken}` },
      });
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe('DOCTOR_NOT_FOUND');
    });

    it('returns 404 DOCUMENT_NOT_FOUND for an unknown document id', async () => {
      const unknownId = '00000000-0000-4000-8000-000000000002';
      const app = makeApp();
      const res = await app.request(`/documents/${unknownId}/shares/${doctorOneId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${patientAToken}` },
      });
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe('DOCUMENT_NOT_FOUND');
    });

    it('returns 403 when caller does not own the document', async () => {
      const app = makeApp();
      // Patient A's token tries to revoke a share on patient B's doc
      const res = await app.request(`/documents/${docByPatientB}/shares/${doctorOneId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${patientAToken}` },
      });
      expect(res.status).toBe(403);
    });

    it('returns 401 without a JWT', async () => {
      const app = makeApp();
      const res = await app.request(`/documents/${docByPatientA}/shares/${doctorOneId}`, {
        method: 'DELETE',
      });
      expect(res.status).toBe(401);
    });

    it('returns 403 with a doctor JWT', async () => {
      const app = makeApp();
      const res = await app.request(`/documents/${docByPatientA}/shares/${doctorOneId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${doctorOneToken}` },
      });
      expect(res.status).toBe(403);
    });
  });
});
