import { z } from 'zod';

const configSchema = z.object({
  DATABASE_URL: z.string().min(1),
  API_PORT: z.coerce.number().int().positive().default(3001),
  JWT_SECRET: z.string().min(32),
  DOCUMENT_STORAGE_PATH: z.string().default('apps/api/storage/documents/'),
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
      .join('; ');
    process.stderr.write(`FATAL: Invalid environment configuration: ${issues}\n`);
    process.exit(1);
  }
  return parsed.data;
}
