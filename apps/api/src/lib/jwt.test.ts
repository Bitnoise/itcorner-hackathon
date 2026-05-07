import { describe, expect, it } from 'vitest';
import { signJwt, verifyJwt } from './jwt';

const SECRET = 'test-secret-that-is-at-least-32-chars-long';

describe('signJwt / verifyJwt', () => {
  it('signs a token and verifies it successfully', () => {
    const token = signJwt({ sub: 'user-123', role: 'patient' }, SECRET);
    const result = verifyJwt(token, SECRET);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.sub).toBe('user-123');
    expect(result.payload.role).toBe('patient');
    expect(result.payload.iat).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
    expect(result.payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('returns expired when token exp is in the past', () => {
    const token = signJwt({ sub: 'user-123', role: 'doctor' }, SECRET, -1);
    const result = verifyJwt(token, SECRET);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('expired');
  });

  it('returns invalid when signature is tampered', () => {
    const token = signJwt({ sub: 'user-123', role: 'patient' }, SECRET);
    const parts = token.split('.');
    const tampered = `${parts[0]}.${parts[1]}.tampered-signature`;
    const result = verifyJwt(tampered, SECRET);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('invalid');
  });

  it('returns invalid for a token signed with a different secret', () => {
    const token = signJwt({ sub: 'user-123', role: 'patient' }, 'different-secret-at-least-32-chars');
    const result = verifyJwt(token, SECRET);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('invalid');
  });

  it('returns invalid for a malformed token (wrong number of parts)', () => {
    const result = verifyJwt('not.a.valid.jwt.at.all', SECRET);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('invalid');
  });

  it('produces a three-part dot-separated string', () => {
    const token = signJwt({ sub: 'user-123', role: 'doctor' }, SECRET);
    expect(token.split('.')).toHaveLength(3);
  });
});
