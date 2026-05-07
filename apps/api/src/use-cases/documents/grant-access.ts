import type { Db } from '../../infrastructure/db';
import {
  findDocumentById,
  grantDocumentShare,
  isUserDoctor,
} from '../../infrastructure/document-repository';

export type GrantAccessResult =
  | { ok: true }
  | { ok: false; reason: 'document_not_found' | 'forbidden' | 'doctor_not_found' };

export async function grantAccess(
  documentId: string,
  doctorId: string,
  callerPatientId: string,
  deps: { db: Db },
): Promise<GrantAccessResult> {
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
  await grantDocumentShare(deps.db, documentId, doctorId);
  return { ok: true };
}
