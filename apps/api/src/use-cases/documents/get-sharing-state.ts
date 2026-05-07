import type { Db } from '../../infrastructure/db';
import {
  findDocumentById,
  listDoctorAccessForDocument,
  type DoctorAccessRow,
} from '../../infrastructure/document-repository';

export type GetSharingStateResult =
  | { ok: true; doctors: DoctorAccessRow[] }
  | { ok: false; reason: 'not_found' | 'forbidden' };

export async function getSharingState(
  documentId: string,
  callerPatientId: string,
  deps: { db: Db },
): Promise<GetSharingStateResult> {
  const doc = await findDocumentById(deps.db, documentId);
  if (!doc) {
    return { ok: false, reason: 'not_found' };
  }
  if (doc.patientId !== callerPatientId) {
    return { ok: false, reason: 'forbidden' };
  }
  const doctors = await listDoctorAccessForDocument(deps.db, documentId);
  return { ok: true, doctors };
}
