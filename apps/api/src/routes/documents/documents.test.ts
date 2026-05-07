import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, rm, readdir, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { createApp } from '../../app';
import { createDb } from '../../infrastructure/db';
import { createLogger } from '../../lib/logger';
import { signJwt } from '../../lib/jwt';
import { users, documents, documentShares } from '../../db/schema';

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
    await db.delete(users).where(eq(users.email, 'doc.other-patient@example.com'));
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

  // AC 7 (Slice 2): DELETE /documents/:id — owner happy path
  describe('AC 7: DELETE /documents/:id by owner', () => {
    it('returns 204 and removes the documents row and disk file', async () => {
      const app = makeApp();

      // Upload a document
      const uploadForm = makePdfFormData('to-delete.pdf', 256);
      const uploadRes = await app.request('/documents', {
        method: 'POST',
        headers: { Authorization: `Bearer ${patientToken}` },
        body: uploadForm,
      });
      expect(uploadRes.status).toBe(201);
      const uploaded = await uploadRes.json() as { id: string };

      // Find the storage filename for this document so we can verify it's gone
      const [docRow] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, uploaded.id));
      expect(docRow).toBeDefined();
      const storedPath = join(tmpDir, docRow!.storagePath);
      // Sanity: file exists before delete
      await expect(access(storedPath, constants.F_OK)).resolves.toBeUndefined();

      // DELETE the document
      const delRes = await app.request(`/documents/${uploaded.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${patientToken}` },
      });

      expect(delRes.status).toBe(204);

      // documents row is gone
      const remaining = await db
        .select()
        .from(documents)
        .where(eq(documents.id, uploaded.id));
      expect(remaining).toHaveLength(0);

      // file on disk is gone
      await expect(access(storedPath, constants.F_OK)).rejects.toThrow();
    });

    it('removes associated document_shares rows atomically with the document', async () => {
      const app = makeApp();

      // Upload a document as the patient
      const uploadForm = makePdfFormData('shared-and-deleted.pdf', 128);
      const uploadRes = await app.request('/documents', {
        method: 'POST',
        headers: { Authorization: `Bearer ${patientToken}` },
        body: uploadForm,
      });
      expect(uploadRes.status).toBe(201);
      const uploaded = await uploadRes.json() as { id: string };

      // Manually insert a share row (sharing endpoints land in slice 3)
      await db.insert(documentShares).values({
        documentId: uploaded.id,
        doctorId: doctorUserId,
      });

      // Sanity: share exists
      const sharesBefore = await db
        .select()
        .from(documentShares)
        .where(eq(documentShares.documentId, uploaded.id));
      expect(sharesBefore).toHaveLength(1);

      // DELETE the document
      const delRes = await app.request(`/documents/${uploaded.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${patientToken}` },
      });
      expect(delRes.status).toBe(204);

      // Both rows are gone
      const docsAfter = await db
        .select()
        .from(documents)
        .where(eq(documents.id, uploaded.id));
      expect(docsAfter).toHaveLength(0);

      const sharesAfter = await db
        .select()
        .from(documentShares)
        .where(eq(documentShares.documentId, uploaded.id));
      expect(sharesAfter).toHaveLength(0);
    });

    it('returns 500 DELETE_FAILED when the disk file is missing after txn commit', async () => {
      const app = makeApp();

      // Upload a document
      const uploadForm = makePdfFormData('disk-fail.pdf', 64);
      const uploadRes = await app.request('/documents', {
        method: 'POST',
        headers: { Authorization: `Bearer ${patientToken}` },
        body: uploadForm,
      });
      expect(uploadRes.status).toBe(201);
      const uploaded = await uploadRes.json() as { id: string };

      // Look up the storage path, then remove the file out-of-band so the
      // disk-side delete will fail after the DB transaction commits.
      const [docRow] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, uploaded.id));
      const storedPath = join(tmpDir, docRow!.storagePath);
      await rm(storedPath, { force: true });

      const delRes = await app.request(`/documents/${uploaded.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${patientToken}` },
      });

      expect(delRes.status).toBe(500);
      const body = await delRes.json() as { error: string; message: string };
      expect(body.error).toBe('DELETE_FAILED');
      expect(body.message).toBe(
        'Document metadata removed but file could not be deleted from storage',
      );

      // The DB row should still be gone — committed txn is the source of truth
      const remaining = await db
        .select()
        .from(documents)
        .where(eq(documents.id, uploaded.id));
      expect(remaining).toHaveLength(0);
    });

    it('returns 403 when called by a different patient', async () => {
      const app = makeApp();

      // Upload a document as the original patient
      const uploadForm = makePdfFormData('not-yours.pdf', 64);
      const uploadRes = await app.request('/documents', {
        method: 'POST',
        headers: { Authorization: `Bearer ${patientToken}` },
        body: uploadForm,
      });
      expect(uploadRes.status).toBe(201);
      const uploaded = await uploadRes.json() as { id: string };

      // Create another patient
      const hash = await bcrypt.hash('password', 4);
      await db.delete(users).where(eq(users.email, 'doc.other-patient@example.com'));
      const [otherPatient] = await db
        .insert(users)
        .values({
          email: 'doc.other-patient@example.com',
          passwordHash: hash,
          role: 'patient',
        })
        .returning();
      const otherToken = signJwt(
        { sub: otherPatient!.id, role: 'patient' },
        JWT_SECRET,
      );

      const delRes = await app.request(`/documents/${uploaded.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${otherToken}` },
      });

      expect(delRes.status).toBe(403);

      // Document still exists
      const remaining = await db
        .select()
        .from(documents)
        .where(eq(documents.id, uploaded.id));
      expect(remaining).toHaveLength(1);

      await db.delete(users).where(eq(users.id, otherPatient!.id));
    });

    it('returns 404 DOCUMENT_NOT_FOUND for an unknown id', async () => {
      const app = makeApp();
      const fakeId = '00000000-0000-4000-8000-000000000000';

      const delRes = await app.request(`/documents/${fakeId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${patientToken}` },
      });

      expect(delRes.status).toBe(404);
      const body = await delRes.json() as { error: string };
      expect(body.error).toBe('DOCUMENT_NOT_FOUND');
    });

    it('returns 401 without a JWT', async () => {
      const app = makeApp();
      const fakeId = '00000000-0000-4000-8000-000000000001';
      const delRes = await app.request(`/documents/${fakeId}`, { method: 'DELETE' });
      expect(delRes.status).toBe(401);
    });

    it('returns 403 with a doctor JWT', async () => {
      const app = makeApp();
      const fakeId = '00000000-0000-4000-8000-000000000002';
      const delRes = await app.request(`/documents/${fakeId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${doctorToken}` },
      });
      expect(delRes.status).toBe(403);
    });
  });
});
