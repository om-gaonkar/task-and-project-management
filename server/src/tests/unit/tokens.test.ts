import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import {
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
  verifyAccessToken,
} from '../../modules/auth/tokens';

const SECRET = 'x'.repeat(40);
const claims = { userId: 'user-1', sessionId: 'session-1' };

describe('access tokens', () => {
  it('round-trips the user and session', () => {
    const token = signAccessToken(claims, SECRET, 60);
    expect(verifyAccessToken(token, SECRET)).toEqual({ ok: true, claims });
  });

  it('distinguishes an expired token from an invalid one', () => {
    const expired = signAccessToken(claims, SECRET, -10);
    expect(verifyAccessToken(expired, SECRET)).toEqual({ ok: false, reason: 'expired' });
    expect(verifyAccessToken('not.a.token', SECRET)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects a token signed with another secret or tampered with', () => {
    const token = signAccessToken(claims, SECRET, 60);
    expect(verifyAccessToken(token, 'y'.repeat(40))).toEqual({ ok: false, reason: 'invalid' });
    const [header, , signature] = token.split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: 'someone-else', sid: 'session-1' }),
    ).toString('base64url');
    expect(verifyAccessToken(`${header}.${forgedPayload}.${signature}`, SECRET).ok).toBe(false);
  });

  it('rejects an unsigned alg:none token', () => {
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const unsigned = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
      sub: 'user-1',
      sid: 'session-1',
      iss: 'daybook-api',
      aud: 'daybook-web',
      exp: Math.floor(Date.now() / 1000) + 600,
    })}.`;
    expect(verifyAccessToken(unsigned, SECRET)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('only accepts the algorithm it issues, even when signed with the right secret', () => {
    const hs384 = jwt.sign({ sid: 's' }, SECRET, {
      algorithm: 'HS384',
      subject: 'u',
      issuer: 'daybook-api',
      audience: 'daybook-web',
      expiresIn: 60,
    });
    expect(verifyAccessToken(hs384, SECRET)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects a validly signed token with the wrong audience or no session claim', () => {
    const wrongAudience = jwt.sign({ sid: 's' }, SECRET, {
      subject: 'u',
      audience: 'other',
      issuer: 'daybook-api',
    });
    const noSession = jwt.sign({}, SECRET, {
      subject: 'u',
      audience: 'daybook-web',
      issuer: 'daybook-api',
    });
    expect(verifyAccessToken(wrongAudience, SECRET).ok).toBe(false);
    expect(verifyAccessToken(noSession, SECRET).ok).toBe(false);
  });
});

describe('refresh tokens', () => {
  it('generates unguessable, unique tokens', () => {
    const tokens = new Set(Array.from({ length: 50 }, generateRefreshToken));
    expect(tokens.size).toBe(50);
    expect([...tokens][0]).toMatch(/^[\w-]{43}$/);
  });

  it('stores a keyed hash, not the token', () => {
    const token = generateRefreshToken();
    const hash = hashRefreshToken(token, SECRET);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    expect(hashRefreshToken(token, SECRET)).toBe(hash);
    expect(hashRefreshToken(token, 'y'.repeat(40))).not.toBe(hash);
  });
});
