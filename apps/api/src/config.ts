import { z } from 'zod';

const configSchema = z.object({
  // Optional during the kickoff slice — Slice 2 introduces the users table and
  // adds a hard requirement plus a real connection at boot.
  DATABASE_URL: z.string().optional(),
  API_PORT: z.coerce.number().int().positive().default(3001),
  // Read but not enforced in this slice. Slice 2 adds the ≥ 32 chars boot guard.
  JWT_SECRET: z.string().optional(),
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return parsed.data;
}
