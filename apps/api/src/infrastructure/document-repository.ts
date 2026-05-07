import { desc, eq } from 'drizzle-orm';
import { documents } from '../db/schema';
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
