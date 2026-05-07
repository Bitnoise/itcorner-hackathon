import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import { eq, inArray } from 'drizzle-orm';
import { createDb } from '../src/infrastructure/db';
import { users, patients, doctors } from '../src/db/schema';
import { seedAccounts } from './seed';

const DATABASE_URL = process.env['DATABASE_URL'];

const testAccounts = [
  {
    email: 'seed.test.doctor@medbridge.test',
    password: 'TestPass1!',
    firstName: 'SeedTest',
    lastName: 'Doctor',
    accountType: 'doctor' as const,
  },
  {
    email: 'seed.test.patient@medbridge.test',
    password: 'TestPass2!',
    firstName: 'SeedTest',
    lastName: 'Patient',
    accountType: 'patient' as const,
  },
];

const testEmails = testAccounts.map((a) => a.email);

const describeWithDb = DATABASE_URL ? describe : describe.skip;

describeWithDb('seed script (integration)', () => {
  const db = createDb(DATABASE_URL!);

  beforeAll(async () => {
    await db.delete(users).where(inArray(users.email, testEmails));
  });

  afterAll(async () => {
    await db.delete(users).where(inArray(users.email, testEmails));
  });

  it('inserts users, patients, and doctors rows on first run', async () => {
    await seedAccounts(db, testAccounts, 4);

    const rows = await db
      .select()
      .from(users)
      .where(inArray(users.email, testEmails));

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.email).sort()).toEqual(testEmails.slice().sort());
  });

  it('is idempotent — running twice does not create duplicate rows', async () => {
    await seedAccounts(db, testAccounts, 4);

    const rows = await db
      .select()
      .from(users)
      .where(inArray(users.email, testEmails));

    expect(rows).toHaveLength(2);
  });

  it('stores bcrypt cost-factor-12 hashes when saltRounds=12', async () => {
    const singleAccount = [testAccounts[0]!];
    await seedAccounts(db, singleAccount, 12);

    const [row] = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, singleAccount[0]!.email))
      .limit(1);

    expect(row).toBeDefined();
    expect(row!.passwordHash).toMatch(/^\$2[ab]\$12\$/);
  });

  it('stored hash verifies against the original plaintext password', async () => {
    const [row] = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, testAccounts[1]!.email))
      .limit(1);

    expect(row).toBeDefined();
    const valid = await bcrypt.compare(testAccounts[1]!.password, row!.passwordHash);
    expect(valid).toBe(true);
  });

  it('seeds the matching patient and doctor profile rows', async () => {
    const [doctorUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, testAccounts[0]!.email))
      .limit(1);
    const [patientUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, testAccounts[1]!.email))
      .limit(1);

    const [doctorRow] = await db
      .select()
      .from(doctors)
      .where(eq(doctors.userId, doctorUser!.id))
      .limit(1);
    const [patientRow] = await db
      .select()
      .from(patients)
      .where(eq(patients.userId, patientUser!.id))
      .limit(1);

    expect(doctorRow?.firstName).toBe('SeedTest');
    expect(patientRow?.firstName).toBe('SeedTest');
  });
});
