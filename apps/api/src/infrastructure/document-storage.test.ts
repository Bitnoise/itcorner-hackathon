import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { createDocumentStorage } from './document-storage';

describe('createDocumentStorage', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'doc-storage-test-'));
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('write returns a UUID string', async () => {
    const storage = createDocumentStorage(tmpDir);
    const content = 'hello world';
    const stream = Readable.toWeb(Readable.from([content])) as ReadableStream;
    const uuid = await storage.write(stream);
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('write saves file content that can be read back', async () => {
    const storage = createDocumentStorage(tmpDir);
    const content = 'test file content for read-back';
    const stream = Readable.toWeb(Readable.from([content])) as ReadableStream;
    const uuid = await storage.write(stream);

    const fileContent = await readFile(join(tmpDir, uuid), 'utf-8');
    expect(fileContent).toBe(content);
  });

  it('read returns a readable stream with the correct content', async () => {
    const storage = createDocumentStorage(tmpDir);
    const content = 'stream read test content';
    const writeStream = Readable.toWeb(Readable.from([content])) as ReadableStream;
    const uuid = await storage.write(writeStream);

    const readStream = storage.read(uuid);
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      readStream.on('data', (chunk: Buffer) => chunks.push(chunk));
      readStream.on('end', resolve);
      readStream.on('error', reject);
    });
    expect(Buffer.concat(chunks).toString('utf-8')).toBe(content);
  });

  it('delete removes the file from disk', async () => {
    const storage = createDocumentStorage(tmpDir);
    const content = 'to be deleted';
    const stream = Readable.toWeb(Readable.from([content])) as ReadableStream;
    const uuid = await storage.write(stream);

    await storage.delete(uuid);

    await expect(readFile(join(tmpDir, uuid))).rejects.toThrow();
  });
});
