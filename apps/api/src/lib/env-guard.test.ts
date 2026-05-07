import { describe, expect, it, vi } from 'vitest';
import { checkEnv } from './env-guard';

describe('checkEnv', () => {
  it('exits with code 1 when JWT_SECRET is missing', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    checkEnv({});

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it('exits with code 1 when JWT_SECRET is shorter than 32 chars', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    checkEnv({ JWT_SECRET: 'too-short' });

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it('does not exit when JWT_SECRET is exactly 32 chars', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);

    checkEnv({ JWT_SECRET: 'a'.repeat(32) });

    expect(exitSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });

  it('does not exit when JWT_SECRET is longer than 32 chars', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);

    checkEnv({ JWT_SECRET: 'dev-only-change-me-please-32-chars-min' });

    expect(exitSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });
});
