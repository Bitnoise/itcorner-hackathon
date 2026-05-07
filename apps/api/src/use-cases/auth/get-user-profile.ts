import type { Db } from '../../infrastructure/db';
import {
  findUserById,
  findPatientProfile,
  findDoctorProfile,
} from '../../infrastructure/user-repository';
import type { Logger } from '../../lib/logger';
import type { UserProfile } from '../../domain/auth/types';

export type GetUserProfileResult =
  | { ok: true; user: UserProfile }
  | { ok: false; reason: 'account_not_found' | 'db_error' };

export async function getUserProfile(
  userId: string,
  db: Db,
  logger: Logger,
): Promise<GetUserProfileResult> {
  try {
    const user = await findUserById(db, userId);

    if (!user) {
      logger.warn('auth.token.invalid', { userId });
      return { ok: false, reason: 'account_not_found' };
    }

    const profile =
      user.role === 'patient'
        ? await findPatientProfile(db, userId)
        : await findDoctorProfile(db, userId);

    const firstName = profile?.firstName ?? '';
    const lastName = profile?.lastName ?? '';

    return {
      ok: true,
      user: { id: user.id, email: user.email, role: user.role, firstName, lastName },
    };
  } catch (err) {
    logger.error('auth.me.db_error', {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, reason: 'db_error' };
  }
}
