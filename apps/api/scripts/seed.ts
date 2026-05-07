import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import type { Db } from '../src/infrastructure/db';
import { createDb } from '../src/infrastructure/db';
import { users, patients, doctors } from '../src/db/schema';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface SeedAccount {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  accountType: 'doctor' | 'patient';
}

export async function seedAccounts(
  db: Db,
  accounts: SeedAccount[],
  saltRounds = 12,
): Promise<void> {
  for (const account of accounts) {
    const hash = await bcrypt.hash(account.password, saltRounds);
    const email = account.email.toLowerCase();

    const [user] = await db
      .insert(users)
      .values({ email, passwordHash: hash, role: account.accountType })
      .onConflictDoUpdate({
        target: users.email,
        set: { passwordHash: hash, updatedAt: sql`now()` },
      })
      .returning({ id: users.id });

    const userId = user!.id;

    if (account.accountType === 'patient') {
      await db
        .insert(patients)
        .values({ userId, firstName: account.firstName, lastName: account.lastName })
        .onConflictDoUpdate({
          target: patients.userId,
          set: {
            firstName: account.firstName,
            lastName: account.lastName,
            updatedAt: sql`now()`,
          },
        });
    } else {
      await db
        .insert(doctors)
        .values({ userId, firstName: account.firstName, lastName: account.lastName })
        .onConflictDoUpdate({
          target: doctors.userId,
          set: {
            firstName: account.firstName,
            lastName: account.lastName,
            updatedAt: sql`now()`,
          },
        });
    }

    process.stdout.write(`  ✓ ${email} (${account.accountType})\n`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const rootEnv = resolve(__dirname, '../../../.env');
  if (existsSync(rootEnv)) {
    for (const line of readFileSync(rootEnv, 'utf-8').split('\n')) {
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      const val = line.slice(eq + 1).trim();
      if (key && !(key in process.env)) process.env[key] = val;
    }
  }

  const DATABASE_URL = process.env['DATABASE_URL'];
  if (!DATABASE_URL) {
    process.stderr.write('FATAL: DATABASE_URL is required. Copy .env.example to .env\n');
    process.exit(1);
  }

  const dataPath = resolve(__dirname, '../../..', 'data/seed-accounts.json');
  const accounts = JSON.parse(readFileSync(dataPath, 'utf8')) as SeedAccount[];

  const db = createDb(DATABASE_URL);

  process.stdout.write(`Seeding ${accounts.length} accounts…\n`);
  await seedAccounts(db, accounts, 12);
  process.stdout.write('Seed complete.\n');
  process.exit(0);
}
