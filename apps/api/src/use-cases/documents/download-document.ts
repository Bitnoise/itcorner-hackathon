import type { Db } from '../../infrastructure/db';
import type { DocumentStorage } from '../../infrastructure/document-storage';
import {
  findDocumentById,
  existsDocumentShare,
} from '../../infrastructure/document-repository';

export type DownloadDocumentResult =
  | {
      ok: true;
      filename: string;
      mimeType: string;
      stream: NodeJS.ReadableStream;
    }
  | { ok: false; reason: 'not_found' | 'access_denied' };

export async function downloadDocument(
  documentId: string,
  doctorId: string,
  deps: { db: Db; storage: DocumentStorage },
): Promise<DownloadDocumentResult> {
  const doc = await findDocumentById(deps.db, documentId);
  if (!doc) {
    return { ok: false, reason: 'not_found' };
  }
  const allowed = await existsDocumentShare(deps.db, documentId, doctorId);
  if (!allowed) {
    return { ok: false, reason: 'access_denied' };
  }
  return {
    ok: true,
    filename: doc.filename,
    mimeType: doc.mimeType,
    stream: deps.storage.read(doc.storagePath),
  };
}
