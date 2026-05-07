import type { Db } from '../../infrastructure/db';
import type { DocumentStorage } from '../../infrastructure/document-storage';
import { insertDocument } from '../../infrastructure/document-repository';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

export interface DocumentMetadata {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
}

export type UploadDocumentResult =
  | { ok: true; document: DocumentMetadata }
  | { ok: false; reason: 'unsupported_media_type' | 'missing_file' | 'db_error' };

export async function uploadDocument(
  file: File | null | undefined,
  patientId: string,
  deps: { db: Db; storage: DocumentStorage },
): Promise<UploadDocumentResult> {
  if (!file) {
    return { ok: false, reason: 'missing_file' };
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return { ok: false, reason: 'unsupported_media_type' };
  }

  const storagePath = await deps.storage.write(file.stream());

  try {
    const row = await insertDocument(deps.db, {
      patientId,
      filename: file.name,
      mimeType: file.type,
      size: file.size,
      storagePath,
    });

    return {
      ok: true,
      document: {
        id: row.id,
        filename: row.filename,
        mimeType: row.mimeType,
        size: row.size,
        uploadedAt: row.uploadedAt,
      },
    };
  } catch {
    // Attempt cleanup if DB insert fails
    await deps.storage.delete(storagePath).catch(() => {});
    return { ok: false, reason: 'db_error' };
  }
}
