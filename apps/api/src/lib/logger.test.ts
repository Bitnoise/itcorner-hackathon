import { describe, expect, it } from 'vitest';
import { createLogger } from './logger';

describe('createLogger redaction', () => {
  it('redacts password and token fields, including nested in objects and arrays', () => {
    const lines: string[] = [];
    const logger = createLogger({ sink: (line) => lines.push(line) });

    logger.info('auth.login.attempt', {
      email: 'patient@example.com',
      password: 'super-secret',
      token: 'eyJhbGciOiJIUzI1NiJ9.payload.sig',
      attempt: {
        body: {
          password: 'nested-secret',
          token: 'nested-token',
          email: 'doctor@example.com',
        },
      },
      retries: [
        { password: 'array-secret-1', code: 1 },
        { password: 'array-secret-2', code: 2 },
      ],
    });

    expect(lines).toHaveLength(1);
    const serialized = lines[0]!;

    // No raw secret value should ever appear in the emitted line.
    expect(serialized).not.toContain('super-secret');
    expect(serialized).not.toContain('eyJhbGciOiJIUzI1NiJ9.payload.sig');
    expect(serialized).not.toContain('nested-secret');
    expect(serialized).not.toContain('nested-token');
    expect(serialized).not.toContain('array-secret-1');
    expect(serialized).not.toContain('array-secret-2');

    const entry = JSON.parse(serialized) as {
      level: string;
      event: string;
      email: string;
      password: string;
      token: string;
      attempt: { body: { password: string; token: string; email: string } };
      retries: Array<{ password: string; code: number }>;
    };
    expect(entry.level).toBe('info');
    expect(entry.event).toBe('auth.login.attempt');
    expect(entry.email).toBe('patient@example.com');
    expect(entry.password).toBe('[REDACTED]');
    expect(entry.token).toBe('[REDACTED]');
    expect(entry.attempt.body.password).toBe('[REDACTED]');
    expect(entry.attempt.body.token).toBe('[REDACTED]');
    expect(entry.attempt.body.email).toBe('doctor@example.com');
    expect(entry.retries[0]!.password).toBe('[REDACTED]');
    expect(entry.retries[0]!.code).toBe(1);
    expect(entry.retries[1]!.password).toBe('[REDACTED]');
  });
});
