import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { Db } from '../../infrastructure/db';
import type { AppConfig } from '../../config';
import type { Logger } from '../../lib/logger';
import type { AppVariables } from '../../domain/auth/types';
import { requireAuth, requireRole } from '../../middleware/require-auth';
import { createDocumentStorage } from '../../infrastructure/document-storage';
import { uploadDocument } from '../../use-cases/documents/upload-document';
import { listDocuments } from '../../use-cases/documents/list-documents';

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

      if (!file || typeof file === 'string') {
        return c.json({ error: 'MISSING_FILE' }, 422);
      }

      const result = await uploadDocument(file as File, patientId, { db: deps.db, storage });

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

  return router;
}
