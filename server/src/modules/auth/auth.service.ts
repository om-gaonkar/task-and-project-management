import type { Logger } from 'pino';
import {
  AppError,
  conflict,
  forbidden,
  notFound,
  unauthorized,
} from '../../shared/errors/app-error';
import type {
  AuthResult,
  DeviceInfo,
  GoogleProfile,
  IssuedSession,
  PublicUser,
  SessionRepository,
  SessionSummary,
  UserRecord,
  UserRepository,
} from './auth.types';
import { hashPassword, verifyAgainstDummy, verifyPassword } from './password';
import {
  generateId,
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
  verifyAccessToken,
  type AccessTokenClaims,
} from './tokens';

export interface AuthConfig {
  accessSecret: string;
  refreshSecret: string;
  accessTtlSeconds: number;
  /** Sliding lifetime of each refresh token. */
  refreshTtlMs: number;
  /** Absolute lifetime of a login session. */
  sessionMaxMs: number;
}

export interface AuthServiceDeps {
  users: UserRepository;
  sessions: SessionRepository;
  config: AuthConfig;
  logger: Pick<Logger, 'warn' | 'info'>;
  now?: () => Date;
}

export interface ActiveSession {
  id: string;
  device: Pick<DeviceInfo, 'browser' | 'os' | 'deviceType' | 'ipAddress'>;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

const INVALID_CREDENTIALS = 'Invalid email or password';
const SESSION_ENDED = 'Your session has ended. Sign in again.';

/** The only way a user record becomes a response. It picks fields, so secrets cannot leak. */
export function toPublicUser(user: UserRecord): PublicUser {
  const providers: PublicUser['providers'] = [];
  if (user.passwordHash) providers.push('password');
  if (user.googleId) providers.push('google');
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl ?? null,
    providers,
    createdAt: user.createdAt.toISOString(),
  };
}

export function createAuthService(deps: AuthServiceDeps) {
  const { users, sessions, config, logger } = deps;
  const now = deps.now ?? (() => new Date());

  interface SessionContext {
    familyId: string;
    sessionCreatedAt: Date;
    sessionExpiresAt: Date;
  }

  async function issueSession(
    user: UserRecord,
    device: DeviceInfo,
    existing?: SessionContext,
  ): Promise<IssuedSession> {
    const at = now();
    const context: SessionContext = existing ?? {
      familyId: generateId(),
      sessionCreatedAt: at,
      sessionExpiresAt: new Date(at.getTime() + config.sessionMaxMs),
    };

    const refreshToken = generateRefreshToken();
    // A refresh token never outlives the session it belongs to.
    const refreshExpiresAt = new Date(
      Math.min(at.getTime() + config.refreshTtlMs, context.sessionExpiresAt.getTime()),
    );

    await sessions.create({
      userId: user.id,
      familyId: context.familyId,
      tokenHash: hashRefreshToken(refreshToken, config.refreshSecret),
      expiresAt: refreshExpiresAt,
      sessionExpiresAt: context.sessionExpiresAt,
      sessionCreatedAt: context.sessionCreatedAt,
      createdAt: at,
      device,
    });

    return {
      accessToken: signAccessToken(
        { userId: user.id, sessionId: context.familyId },
        config.accessSecret,
        config.accessTtlSeconds,
      ),
      expiresIn: config.accessTtlSeconds,
      refreshToken,
      refreshExpiresAt,
    };
  }

  async function startSession(user: UserRecord, device: DeviceInfo): Promise<AuthResult> {
    const session = await issueSession(user, device);
    await users.touchLastLogin(user.id, now());
    return { user: toPublicUser(user), session };
  }

  return {
    async register(
      input: { name: string; email: string; password: string },
      device: DeviceInfo,
    ): Promise<AuthResult> {
      if (await users.findByEmail(input.email)) {
        throw conflict('An account with this email already exists');
      }
      const user = await users.create({
        name: input.name,
        email: input.email,
        passwordHash: await hashPassword(input.password),
        // Nothing has proven the person owns this address yet. Google linking relies on this flag.
        emailVerified: false,
      });
      return startSession(user, device);
    },

    async login(
      input: { email: string; password: string },
      device: DeviceInfo,
    ): Promise<AuthResult> {
      const user = await users.findByEmail(input.email);
      if (!user?.passwordHash) {
        await verifyAgainstDummy(input.password);
        throw unauthorized(INVALID_CREDENTIALS);
      }
      if (!(await verifyPassword(input.password, user.passwordHash))) {
        throw unauthorized(INVALID_CREDENTIALS);
      }
      if (!user.isActive) {
        throw forbidden('This account has been disabled');
      }
      return startSession(user, device);
    },

    /**
     * Rotation: every refresh token works exactly once. Presenting one a second time means it
     * leaked (or a client raced itself), so the whole session is revoked rather than guessing
     * which party is the real one.
     */
    async refresh(token: string, device: DeviceInfo): Promise<AuthResult> {
      const at = now();
      const stored = await sessions.findByTokenHash(hashRefreshToken(token, config.refreshSecret));
      if (!stored) throw unauthorized(SESSION_ENDED);

      if (stored.status === 'used') {
        await sessions.revokeFamily(stored.familyId, at);
        logger.warn(
          { userId: stored.userId, familyId: stored.familyId },
          'Refresh token reuse detected, session revoked',
        );
        throw unauthorized(SESSION_ENDED);
      }
      if (stored.status === 'revoked') throw unauthorized(SESSION_ENDED);

      if (stored.expiresAt <= at || stored.sessionExpiresAt <= at) {
        await sessions.revokeFamily(stored.familyId, at);
        throw unauthorized(SESSION_ENDED);
      }

      const user = await users.findById(stored.userId);
      if (!user?.isActive) {
        await sessions.revokeFamily(stored.familyId, at);
        throw unauthorized(SESSION_ENDED);
      }

      // Two requests with the same token can both reach this line. Only one wins the atomic flip.
      if (!(await sessions.markUsed(stored.id, at))) {
        await sessions.revokeFamily(stored.familyId, at);
        logger.warn(
          { userId: stored.userId, familyId: stored.familyId },
          'Concurrent refresh, session revoked',
        );
        throw unauthorized(SESSION_ENDED);
      }

      const issued = await issueSession(user, device, {
        familyId: stored.familyId,
        sessionCreatedAt: stored.sessionCreatedAt,
        sessionExpiresAt: stored.sessionExpiresAt,
      });
      return { user: toPublicUser(user), session: issued };
    },

    /** Never throws: signing out must work even when the token is stale or unknown. */
    async logout(token: string | undefined): Promise<void> {
      if (!token) return;
      const stored = await sessions.findByTokenHash(hashRefreshToken(token, config.refreshSecret));
      if (stored) await sessions.revokeFamily(stored.familyId, now());
    },

    async logoutAll(userId: string): Promise<number> {
      return sessions.revokeAllForUser(userId, now());
    },

    async revokeSession(userId: string, familyId: string): Promise<void> {
      // Same answer for "not yours" and "does not exist", so session ids cannot be probed.
      const revoked = await sessions.revokeFamilyForUser(userId, familyId, now());
      if (revoked === 0) throw notFound('Session not found');
    },

    async listSessions(userId: string, currentSessionId: string): Promise<ActiveSession[]> {
      const rows: SessionSummary[] = await sessions.listActive(userId, now());
      return rows.map((row) => ({
        id: row.familyId,
        device: {
          browser: row.device.browser,
          os: row.device.os,
          deviceType: row.device.deviceType,
          ipAddress: row.device.ipAddress,
        },
        createdAt: row.sessionCreatedAt.toISOString(),
        lastActiveAt: row.lastActiveAt.toISOString(),
        expiresAt: row.sessionExpiresAt.toISOString(),
        isCurrent: row.familyId === currentSessionId,
      }));
    },

    async getUser(userId: string): Promise<PublicUser> {
      const user = await users.findById(userId);
      if (!user?.isActive) throw notFound('User not found');
      return toPublicUser(user);
    },

    /**
     * Checks the signature and also that the session still exists, so "sign out everywhere"
     * and "remove this device" take effect immediately instead of after the access token expires.
     */
    async authenticate(accessToken: string): Promise<AccessTokenClaims> {
      const result = verifyAccessToken(accessToken, config.accessSecret);
      if (!result.ok) {
        throw result.reason === 'expired'
          ? new AppError(401, 'ACCESS_TOKEN_EXPIRED', 'The access token has expired')
          : unauthorized('Invalid access token');
      }
      if (!(await sessions.hasActiveSession(result.claims.sessionId, now()))) {
        throw new AppError(401, 'SESSION_REVOKED', SESSION_ENDED);
      }
      return result.claims;
    },

    async loginWithGoogle(profile: GoogleProfile, device: DeviceInfo): Promise<AuthResult> {
      if (!profile.emailVerified) {
        throw unauthorized('Google has not verified this email address');
      }

      let user = await users.findByGoogleId(profile.googleId);

      if (!user) {
        const existing = await users.findByEmail(profile.email);
        if (existing) {
          if (existing.googleId && existing.googleId !== profile.googleId) {
            throw conflict('This email is already linked to a different Google account');
          }
          // Pre-hijacking guard: anyone can register a password account with someone else's
          // address, because we never verified it. If that account is now claimed through Google
          // (which did verify the address), the password may belong to an attacker, so it is
          // removed and every existing session is ended before the account is linked.
          const untrustedPassword = Boolean(existing.passwordHash) && !existing.emailVerified;
          if (untrustedPassword) {
            await sessions.revokeAllForUser(existing.id, now());
            logger.warn(
              { userId: existing.id },
              'Unverified password removed while linking Google',
            );
          }
          user = await users.linkGoogle(existing.id, {
            googleId: profile.googleId,
            avatarUrl: profile.avatarUrl,
            dropPassword: untrustedPassword,
          });
        } else {
          user = await users.create({
            name: profile.name,
            email: profile.email,
            googleId: profile.googleId,
            avatarUrl: profile.avatarUrl,
            emailVerified: true,
          });
        }
      }

      if (!user) throw notFound('User not found');
      if (!user.isActive) throw forbidden('This account has been disabled');
      return startSession(user, device);
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
