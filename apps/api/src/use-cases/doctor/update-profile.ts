import type { Db } from '../../infrastructure/db';
import type { Logger } from '../../lib/logger';
import {
  findDoctorProfile,
  updateDoctorProfile,
  type DoctorProfileUpdate,
} from '../../infrastructure/user-repository';
import type { DoctorProfile } from './get-profile';

export type UpdateDoctorProfileResult =
  | { ok: true; profile: DoctorProfile }
  | { ok: false; reason: 'not_found' };

export async function updateProfile(
  doctorUserId: string,
  fields: DoctorProfileUpdate,
  deps: { db: Db; logger: Logger },
): Promise<UpdateDoctorProfileResult> {
  const row =
    Object.keys(fields).length === 0
      ? await findDoctorProfile(deps.db, doctorUserId)
      : await updateDoctorProfile(deps.db, doctorUserId, fields);

  if (!row) {
    return { ok: false, reason: 'not_found' };
  }

  if (Object.keys(fields).length > 0) {
    deps.logger.info('doctor.profile.updated', {
      userId: doctorUserId,
      fields: Object.keys(fields),
    });
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
