import type { Db } from '../../infrastructure/db';
import { listDocumentsSharedWithDoctor } from '../../infrastructure/document-repository';

export interface SharedDocumentMetadata {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
}

export interface PatientSharedDocuments {
  patientId: string;
  patientDisplayName: string;
  documents: SharedDocumentMetadata[];
}

export async function getSharedWithMe(
  doctorId: string,
  deps: { db: Db },
): Promise<PatientSharedDocuments[]> {
  const rows = await listDocumentsSharedWithDoctor(deps.db, doctorId);

  const groups = new Map<string, PatientSharedDocuments>();
  for (const row of rows) {
    let group = groups.get(row.patientId);
    if (!group) {
      group = {
        patientId: row.patientId,
        patientDisplayName: `${row.patientFirstName} ${row.patientLastName}`,
        documents: [],
      };
      groups.set(row.patientId, group);
    }
    group.documents.push({
      id: row.documentId,
      filename: row.filename,
      mimeType: row.mimeType,
      size: row.size,
      uploadedAt: row.uploadedAt,
    });
  }
  return Array.from(groups.values());
}
