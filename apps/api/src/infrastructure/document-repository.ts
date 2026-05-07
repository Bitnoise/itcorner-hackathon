import { and, desc, eq } from 'drizzle-orm';
import { documents, documentShares, doctors, users } from '../db/schema';
import type { Db } from './db';

export type DocumentRow = typeof documents.$inferSelect;

export interface DoctorAccessRow {
  doctorId: string;
  displayName: string;
  hasAccess: boolean;
}

export async function insertDocument(
  db: Db,
  data: {
    patientId: string;
    filename: string;
    mimeType: string;
    size: number;
    storagePath: string;
  },
): Promise<DocumentRow> {
  const [row] = await db
    .insert(documents)
    .values({
      patientId: data.patientId,
      filename: data.filename,
      mimeType: data.mimeType,
      size: data.size,
      storagePath: data.storagePath,
    })
    .returning();
  return row!;
}

export async function listDocumentsByPatient(
  db: Db,
  patientId: string,
): Promise<DocumentRow[]> {
  return db
    .select()
    .from(documents)
    .where(eq(documents.patientId, patientId))
    .orderBy(desc(documents.uploadedAt));
}

export async function findDocumentById(
  db: Db,
  documentId: string,
): Promise<DocumentRow | undefined> {
  const [row] = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
  return row;
}

export async function isUserDoctor(db: Db, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.role, 'doctor')))
    .limit(1);
  return !!row;
}

export async function listDoctorAccessForDocument(
  db: Db,
  documentId: string,
): Promise<DoctorAccessRow[]> {
  // Left join doctors → document_shares filtered by documentId.
  // Each doctor appears once; hasAccess is true iff a matching share row exists.
  const rows = await db
    .select({
      doctorId: doctors.userId,
      firstName: doctors.firstName,
      lastName: doctors.lastName,
      shareDocId: documentShares.documentId,
    })
    .from(doctors)
    .leftJoin(
      documentShares,
      and(
        eq(documentShares.doctorId, doctors.userId),
        eq(documentShares.documentId, documentId),
      ),
    );

  return rows.map((r) => ({
    doctorId: r.doctorId,
    displayName: `${r.firstName} ${r.lastName}`,
    hasAccess: r.shareDocId !== null,
  }));
}

export async function grantDocumentShare(
  db: Db,
  documentId: string,
  doctorId: string,
): Promise<void> {
  await db
    .insert(documentShares)
    .values({ documentId, doctorId })
    .onConflictDoNothing();
}

export async function revokeDocumentShare(
  db: Db,
  documentId: string,
  doctorId: string,
): Promise<void> {
  await db
    .delete(documentShares)
    .where(
      and(
        eq(documentShares.documentId, documentId),
        eq(documentShares.doctorId, doctorId),
      ),
    );
}

