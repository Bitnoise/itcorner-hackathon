import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { Readable } from 'node:stream';
import type { Db } from '../../infrastructure/db';
import type { AppConfig } from '../../config';
import type { Logger } from '../../lib/logger';
import type { AppVariables } from '../../domain/auth/types';
import { requireAuth, requireRole } from '../../middleware/require-auth';
import { createDocumentStorage } from '../../infrastructure/document-storage';
import { uploadDocument } from '../../use-cases/documents/upload-document';
import { listDocuments } from '../../use-cases/documents/list-documents';
import { getSharingState } from '../../use-cases/documents/get-sharing-state';
import { grantAccess } from '../../use-cases/documents/grant-access';
import { revokeAccess } from '../../use-cases/documents/revoke-access';
import { getSharedWithMe } from '../../use-cases/documents/get-shared-with-me';
import { downloadDocument } from '../../use-cases/documents/download-document';

const MAX_BODY_SIZE = 10 * 1024 * 1024 + 1; // 10 MiB + 1 byte

export interface DocumentsDeps {
  db: Db;
  config: Pick<AppConfig, 'JWT_SECRET' | 'DOCUMENT_STORAGE_PATH'>;
  logger: Logger;
}

export function createDocumentsRouter(
  deps: DocumentsDeps,
): Hono<{ Variables: AppVariables }> {
  const router = new Hono<{ Variables: AppVariables }>();
  const storage = createDocumentStorage(deps.config.DOCUMENT_STORAGE_PATH);

  router.use('/documents', requireAuth(deps));
  router.use('/documents', requireRole(['patient'], deps));

  router.post(
    '/documents',
    bodyLimit({
      maxSize: MAX_BODY_SIZE,
      onError: (c) => c.json({ error: 'FILE_TOO_LARGE' }, 413),
    }),
    async (c) => {
      const patientId = c.get('userId');
      const body = await c.req.parseBody();
      const file = body['file'];

      if (!(file instanceof File)) {
        return c.json({ error: 'MISSING_FILE' }, 422);
      }

      const result = await uploadDocument(file, patientId, { db: deps.db, storage });

      if (!result.ok) {
        if (result.reason === 'missing_file') {
          return c.json({ error: 'MISSING_FILE' }, 422);
        }
        if (result.reason === 'unsupported_media_type') {
          return c.json({ error: 'UNSUPPORTED_MEDIA_TYPE' }, 415);
        }
        return c.json({ error: 'INTERNAL_SERVER_ERROR' }, 500);
      }

      return c.json(
        {
          id: result.document.id,
          filename: result.document.filename,
          mimeType: result.document.mimeType,
          size: result.document.size,
          uploadedAt: result.document.uploadedAt.toISOString(),
        },
        201,
      );
    },
  );

  router.get('/documents', async (c) => {
    const patientId = c.get('userId');
    const docs = await listDocuments(patientId, { db: deps.db });
    return c.json(
      docs.map((d) => ({
        id: d.id,
        filename: d.filename,
        mimeType: d.mimeType,
        size: d.size,
        uploadedAt: d.uploadedAt.toISOString(),
      })),
      200,
    );
  });

  // Doctor-side endpoints. The literal-path /documents/shared-with-me MUST be
  // registered before the param route /documents/:id/file so it isn't shadowed.
  router.get(
    '/documents/shared-with-me',
    requireAuth(deps),
    requireRole(['doctor'], deps),
    async (c) => {
      const doctorId = c.get('userId');
      const groups = await getSharedWithMe(doctorId, { db: deps.db });
      return c.json(
        groups.map((g) => ({
          patientId: g.patientId,
          patientDisplayName: g.patientDisplayName,
          documents: g.documents.map((d) => ({
            id: d.id,
            filename: d.filename,
            mimeType: d.mimeType,
            size: d.size,
            uploadedAt: d.uploadedAt.toISOString(),
          })),
        })),
        200,
      );
    },
  );

  router.get(
    '/documents/:id/file',
    requireAuth(deps),
    requireRole(['doctor'], deps),
    async (c) => {
      const documentId = c.req.param('id');
      const doctorId = c.get('userId');
      const result = await downloadDocument(documentId, doctorId, {
        db: deps.db,
        storage,
      });
      if (!result.ok) {
        if (result.reason === 'not_found') {
          return c.json({ error: 'DOCUMENT_NOT_FOUND' }, 404);
        }
        return c.json({ error: 'ACCESS_DENIED' }, 403);
      }
      // storage.read returns NodeJS.ReadableStream; Readable.toWeb needs a concrete
      // Readable instance, and its return type ReadableStream<any> doesn't structurally
      // match the global ReadableStream that Response expects, so a second cast is
      // unavoidable until @types/node aligns.
      const webStream = Readable.toWeb(
        result.stream as Readable,
      ) as unknown as ReadableStream;
      // Escape any quotes or backslashes in the original filename so a malicious or
      // unusual name cannot break out of the Content-Disposition quoted-string.
      const safeFilename = result.filename.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      return new Response(webStream, {
        status: 200,
        headers: {
          'Content-Type': result.mimeType,
          'Content-Disposition': `attachment; filename="${safeFilename}"`,
        },
      });
    },
  );

  // Sub-paths: parent .use('/documents', ...) does not match /documents/:id/shares,
  // so each sub-path opts in to auth + patient role inline.
  router.get(
    '/documents/:id/shares',
    requireAuth(deps),
    requireRole(['patient'], deps),
    async (c) => {
      const documentId = c.req.param('id');
      const patientId = c.get('userId');
      const result = await getSharingState(documentId, patientId, { db: deps.db });
      if (!result.ok) {
        if (result.reason === 'not_found') {
          return c.json({ error: 'DOCUMENT_NOT_FOUND' }, 404);
        }
        return c.json({ error: 'FORBIDDEN' }, 403);
      }
      return c.json(result.doctors, 200);
    },
  );

  router.put(
    '/documents/:id/shares/:doctorId',
    requireAuth(deps),
    requireRole(['patient'], deps),
    async (c) => {
      const documentId = c.req.param('id');
      const doctorId = c.req.param('doctorId');
      const patientId = c.get('userId');
      const result = await grantAccess(documentId, doctorId, patientId, { db: deps.db });
      if (!result.ok) {
        if (result.reason === 'document_not_found') {
          return c.json({ error: 'DOCUMENT_NOT_FOUND' }, 404);
        }
        if (result.reason === 'doctor_not_found') {
          return c.json({ error: 'DOCTOR_NOT_FOUND' }, 404);
        }
        return c.json({ error: 'FORBIDDEN' }, 403);
      }
      return c.json({ ok: true }, 200);
    },
  );

  router.delete(
    '/documents/:id/shares/:doctorId',
    requireAuth(deps),
    requireRole(['patient'], deps),
    async (c) => {
      const documentId = c.req.param('id');
      const doctorId = c.req.param('doctorId');
      const patientId = c.get('userId');
      const result = await revokeAccess(documentId, doctorId, patientId, { db: deps.db });
      if (!result.ok) {
        if (result.reason === 'document_not_found') {
          return c.json({ error: 'DOCUMENT_NOT_FOUND' }, 404);
        }
        if (result.reason === 'doctor_not_found') {
          return c.json({ error: 'DOCTOR_NOT_FOUND' }, 404);
        }
        return c.json({ error: 'FORBIDDEN' }, 403);
      }
      return c.json({ ok: true }, 200);
    },
  );

  return router;
}
