import { createHmac, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';

const ISSUER = 'daybook-api';
const AUDIENCE = 'daybook-web';

export interface AccessTokenClaims {
  userId: string;
  /** The session (refresh token family) this access token belongs to. */
  sessionId: string;
}

export function signAccessToken(
  claims: AccessTokenClaims,
  secret: string,
  ttlSeconds: number,
): string {
  return jwt.sign({ sid: claims.sessionId }, secret, {
    algorithm: 'HS256',
    subject: claims.userId,
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: ttlSeconds,
  });
}

export type AccessTokenResult =
  { ok: true; claims: AccessTokenClaims } | { ok: false; reason: 'expired' | 'invalid' };

/** The algorithm is pinned so a forged "alg: none" or RS/HS confusion token is rejected. */
export function verifyAccessToken(token: string, secret: string): AccessTokenResult {
  try {
    const payload = jwt.verify(token, secret, {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (
      typeof payload === 'string' ||
      typeof payload.sub !== 'string' ||
      typeof payload.sid !== 'string'
    ) {
      return { ok: false, reason: 'invalid' };
    }
    return { ok: true, claims: { userId: payload.sub, sessionId: payload.sid } };
  } catch (error) {
    return { ok: false, reason: error instanceof jwt.TokenExpiredError ? 'expired' : 'invalid' };
  }
}

/** Refresh tokens are opaque: 256 random bits, meaningless without the database row. */
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function generateId(): string {
  return randomBytes(16).toString('hex');
}

/** Only this keyed hash is stored, so a leaked database cannot be replayed as refresh tokens. */
export function hashRefreshToken(token: string, secret: string): string {
  return createHmac('sha256', secret).update(token).digest('hex');
}
