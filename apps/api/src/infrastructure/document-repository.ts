import { desc, eq } from 'drizzle-orm';
import { documents, documentShares } from '../db/schema';
import type { Db } from './db';

export type DocumentRow = typeof documents.$inferSelect;

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
): Promise<DocumentRow | null> {
  const [row] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId));
  return row ?? null;
}

export async function deleteDocumentWithSharesById(
  db: Db,
  documentId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .delete(documentShares)
      .where(eq(documentShares.documentId, documentId));
    await tx.delete(documents).where(eq(documents.id, documentId));
  });
}
