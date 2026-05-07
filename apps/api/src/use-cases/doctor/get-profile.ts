import type { Db } from '../../infrastructure/db';
import { findDoctorProfile } from '../../infrastructure/user-repository';

export interface DoctorProfile {
  userId: string;
  firstName: string;
  lastName: string;
  specialization: string | null;
}

export type GetDoctorProfileResult =
  | { ok: true; profile: DoctorProfile }
  | { ok: false; reason: 'not_found' };

export async function getDoctorProfile(
  doctorUserId: string,
  deps: { db: Db },
): Promise<GetDoctorProfileResult> {
  const row = await findDoctorProfile(deps.db, doctorUserId);
  if (!row) {
    return { ok: false, reason: 'not_found' };
  }
  return {
    ok: true,
    profile: {
      userId: row.userId,
      firstName: row.firstName,
      lastName: row.lastName,
      specialization: row.specialization ?? null,
    },
  };
}
