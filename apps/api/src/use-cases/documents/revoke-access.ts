import type { Db } from '../../infrastructure/db';
import {
  findDocumentById,
  isUserDoctor,
  revokeDocumentShare,
} from '../../infrastructure/document-repository';

export type RevokeAccessResult =
  | { ok: true }
  | { ok: false; reason: 'document_not_found' | 'forbidden' | 'doctor_not_found' };

export async function revokeAccess(
  documentId: string,
  doctorId: string,
  callerPatientId: string,
  deps: { db: Db },
): Promise<RevokeAccessResult> {
  const doc = await findDocumentById(deps.db, documentId);
  if (!doc) {
    return { ok: false, reason: 'document_not_found' };
  }
  if (doc.patientId !== callerPatientId) {
    return { ok: false, reason: 'forbidden' };
  }
  const doctorExists = await isUserDoctor(deps.db, doctorId);
  if (!doctorExists) {
    return { ok: false, reason: 'doctor_not_found' };
  }
  await revokeDocumentShare(deps.db, documentId, doctorId);
  return { ok: true };
}
