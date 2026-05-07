import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export interface DocumentStorage {
  write(stream: ReadableStream): Promise<string>;
  read(uuid: string): NodeJS.ReadableStream;
  delete(uuid: string): Promise<void>;
}

export function createDocumentStorage(storagePath: string): DocumentStorage {
  return {
    async write(stream: ReadableStream): Promise<string> {
      const uuid = randomUUID();
      const filePath = join(storagePath, uuid);
      const nodeStream = Readable.fromWeb(stream);
      const writeStream = createWriteStream(filePath);
      await pipeline(nodeStream, writeStream);
      return uuid;
    },

    read(uuid: string): NodeJS.ReadableStream {
      const filePath = join(storagePath, uuid);
      return createReadStream(filePath);
    },

    async delete(uuid: string): Promise<void> {
      const filePath = join(storagePath, uuid);
      await unlink(filePath);
    },
  };
}
