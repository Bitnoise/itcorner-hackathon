import { eq, sql } from 'drizzle-orm';
import { users, patients, doctors } from '../db/schema';
import type { Db } from './db';

export type UserRow = typeof users.$inferSelect;
export type PatientRow = typeof patients.$inferSelect;
export type DoctorRow = typeof doctors.$inferSelect;

export async function findUserByEmail(db: Db, email: string): Promise<UserRow | undefined> {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(sql`lower(${users.email})`, email.toLowerCase()))
    .limit(1);
  return row;
}

export async function findUserById(db: Db, id: string): Promise<UserRow | undefined> {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row;
}

export async function findPatientProfile(
  db: Db,
  userId: string,
): Promise<PatientRow | undefined> {
  const [row] = await db.select().from(patients).where(eq(patients.userId, userId)).limit(1);
  return row;
}

export async function findDoctorProfile(
  db: Db,
  userId: string,
): Promise<DoctorRow | undefined> {
  const [row] = await db.select().from(doctors).where(eq(doctors.userId, userId)).limit(1);
  return row;
}
