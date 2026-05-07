import { defineConfig } from 'vitest/config';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve('.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    const val = line.slice(eqIdx + 1).trim();
    if (key && !(key in process.env)) process.env[key] = val;
  }
}

export default defineConfig({
  test: {
    include: [
      'apps/api/src/**/*.test.ts',
      'apps/api/scripts/**/*.test.ts',
      'packages/contracts/src/**/*.test.ts',
    ],
    environment: 'node',
    globals: true,
  },
});
