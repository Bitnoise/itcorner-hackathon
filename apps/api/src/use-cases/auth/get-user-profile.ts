import { eq } from 'drizzle-orm';
import type { Db } from '../../infrastructure/db';
import type { Logger } from '../../lib/logger';
import { users, patients, doctors } from '../../db/schema';
import type { UserProfile } from '../../domain/auth/types';

export type GetUserProfileResult =
  | { ok: true; user: UserProfile }
  | { ok: false; reason: 'account_not_found' };

export async function getUserProfile(
  userId: string,
  db: Db,
  logger: Logger,
): Promise<GetUserProfileResult> {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user) {
      logger.warn('auth.token.invalid', { userId });
      return { ok: false, reason: 'account_not_found' };
    }

    let firstName = '';
    let lastName = '';

    if (user.role === 'patient') {
      const [profile] = await db
        .select()
        .from(patients)
        .where(eq(patients.userId, userId))
        .limit(1);
      firstName = profile?.firstName ?? '';
      lastName = profile?.lastName ?? '';
    } else {
      const [profile] = await db
        .select()
        .from(doctors)
        .where(eq(doctors.userId, userId))
        .limit(1);
      firstName = profile?.firstName ?? '';
      lastName = profile?.lastName ?? '';
    }

    return {
      ok: true,
      user: { id: user.id, email: user.email, role: user.role, firstName, lastName },
    };
  } catch (err) {
    logger.error('auth.me.db_error', {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, reason: 'account_not_found' };
  }
}
