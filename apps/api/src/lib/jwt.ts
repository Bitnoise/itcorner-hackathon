import { createHmac } from 'node:crypto';

export interface JwtPayload {
  sub: string;
  role: 'doctor' | 'patient';
  iat: number;
  exp: number;
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlDecode(s: string): Buffer {
  const pad = (4 - (s.length % 4)) % 4;
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad), 'base64');
}

export function signJwt(
  payload: Pick<JwtPayload, 'sub' | 'role'>,
  secret: string,
  expiresInSeconds = 86400,
): string {
  const header = base64UrlEncode(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const now = Math.floor(Date.now() / 1000);
  const claims = base64UrlEncode(
    Buffer.from(JSON.stringify({ ...payload, iat: now, exp: now + expiresInSeconds })),
  );
  const sig = base64UrlEncode(
    createHmac('sha256', secret).update(`${header}.${claims}`).digest(),
  );
  return `${header}.${claims}.${sig}`;
}

export type JwtVerifyResult =
  | { ok: true; payload: JwtPayload }
  | { ok: false; reason: 'invalid' | 'expired' };

export function verifyJwt(token: string, secret: string): JwtVerifyResult {
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'invalid' };

  const [header, claims, sig] = parts as [string, string, string];

  const expectedSig = base64UrlEncode(
    createHmac('sha256', secret).update(`${header}.${claims}`).digest(),
  );
  if (expectedSig !== sig) return { ok: false, reason: 'invalid' };

  let payload: JwtPayload;
  try {
    const parsed: unknown = JSON.parse(base64UrlDecode(claims).toString());
    const p = parsed as Record<string, unknown>;
    const role = p['role'];
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof p['sub'] !== 'string' ||
      (role !== 'doctor' && role !== 'patient') ||
      typeof p['iat'] !== 'number' ||
      typeof p['exp'] !== 'number'
    ) {
      return { ok: false, reason: 'invalid' };
    }
    payload = parsed as JwtPayload;
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  if (Math.floor(Date.now() / 1000) > payload.exp) return { ok: false, reason: 'expired' };

  return { ok: true, payload };
}
