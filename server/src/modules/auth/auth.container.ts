import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { createAuthService } from './auth.service';
import { createGoogleProvider } from './google.provider';
import { mongoSessionRepository } from './session.repository';
import { mongoUserRepository } from './user.repository';

const DAY_MS = 24 * 60 * 60 * 1000;

/** The production wiring. Tests build their own services from fakes instead. */
export const authService = createAuthService({
  users: mongoUserRepository,
  sessions: mongoSessionRepository,
  logger,
  config: {
    accessSecret: env.ACCESS_TOKEN_SECRET,
    refreshSecret: env.REFRESH_TOKEN_SECRET,
    accessTtlSeconds: env.ACCESS_TOKEN_TTL_MINUTES * 60,
    refreshTtlMs: env.REFRESH_TOKEN_TTL_DAYS * DAY_MS,
    sessionMaxMs: env.SESSION_MAX_AGE_DAYS * DAY_MS,
  },
});

export const googleProvider = createGoogleProvider(
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_CALLBACK_URL
    ? {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackUrl: env.GOOGLE_CALLBACK_URL,
      }
    : null,
);
