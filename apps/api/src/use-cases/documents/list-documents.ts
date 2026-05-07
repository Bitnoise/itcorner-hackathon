import type { Db } from '../../infrastructure/db';
import { listDocumentsByPatient } from '../../infrastructure/document-repository';
import type { DocumentMetadata } from './upload-document';

export async function listDocuments(
  patientId: string,
  deps: { db: Db },
): Promise<DocumentMetadata[]> {
  const rows = await listDocumentsByPatient(deps.db, patientId);
  return rows.map((row) => ({
    id: row.id,
    filename: row.filename,
    mimeType: row.mimeType,
    size: row.size,
    uploadedAt: row.uploadedAt,
  }));
}
