import bcrypt from 'bcryptjs';
import { sql, eq } from 'drizzle-orm';
import type { Db } from '../../infrastructure/db';
import { signJwt } from '../../lib/jwt';
import type { Logger } from '../../lib/logger';
import { users } from '../../db/schema';
import type { AppConfig } from '../../config';

export type LoginResult =
  | { ok: true; token: string }
  | { ok: false; reason: 'invalid_credentials' | 'db_error' };

export async function login(
  email: string,
  password: string,
  deps: { db: Db; config: Pick<AppConfig, 'JWT_SECRET'>; logger: Logger },
): Promise<LoginResult> {
  try {
    const [user] = await deps.db
      .select()
      .from(users)
      .where(eq(sql`lower(${users.email})`, email.toLowerCase()))
      .limit(1);

    if (!user) {
      deps.logger.warn('auth.login.failed', { email });
      return { ok: false, reason: 'invalid_credentials' };
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      deps.logger.warn('auth.login.failed', { email });
      return { ok: false, reason: 'invalid_credentials' };
    }

    const token = signJwt({ sub: user.id, role: user.role }, deps.config.JWT_SECRET);
    deps.logger.info('auth.login.success', { userId: user.id, role: user.role });
    return { ok: true, token };
  } catch (err) {
    deps.logger.error('auth.login.db_error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, reason: 'db_error' };
  }
}
