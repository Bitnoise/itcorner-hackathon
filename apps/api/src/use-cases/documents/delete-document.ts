import type { Db } from '../../infrastructure/db';
import type { DocumentStorage } from '../../infrastructure/document-storage';
import {
  deleteDocumentWithSharesById,
  findDocumentById,
} from '../../infrastructure/document-repository';

export type DeleteDocumentResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'forbidden' | 'disk_delete_failed' };

export async function deleteDocument(
  documentId: string,
  patientId: string,
  deps: { db: Db; storage: DocumentStorage },
): Promise<DeleteDocumentResult> {
  const row = await findDocumentById(deps.db, documentId);
  if (!row) {
    return { ok: false, reason: 'not_found' };
  }
  if (row.patientId !== patientId) {
    return { ok: false, reason: 'forbidden' };
  }

  await deleteDocumentWithSharesById(deps.db, documentId);

  try {
    await deps.storage.delete(row.storagePath);
  } catch {
    return { ok: false, reason: 'disk_delete_failed' };
  }

  return { ok: true };
}
