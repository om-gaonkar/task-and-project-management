import { timingSafeEqual } from 'node:crypto';
import type { Request, RequestHandler, Response } from 'express';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { getValidated } from '../../middleware/validate';
import { unauthorized } from '../../shared/errors/app-error';
import { sendNoContent, sendSuccess } from '../../shared/utils/response';
import {
  clearOAuthCookie,
  clearRefreshCookie,
  OAUTH_COOKIE,
  readOAuthCookie,
  REFRESH_COOKIE,
  setOAuthCookie,
  setRefreshCookie,
} from './auth.cookies';
import { authService, googleProvider } from './auth.container';
import { requireAuth } from './auth.middleware';
import type { LoginBody, RegisterBody } from './auth.schemas';
import type { AuthResult } from './auth.types';
import { parseUserAgent } from './user-agent';

/** req.ip honours the TRUST_PROXY setting, unlike reading X-Forwarded-For, which anyone can fake. */
const deviceOf = (req: Request) => parseUserAgent(req.get('user-agent'), req.ip);

/** The browser keeps the access token in memory and the refresh token in the cookie. */
function respondWithSession(res: Response, result: AuthResult, status = 200): void {
  setRefreshCookie(res, result.session.refreshToken, result.session.refreshExpiresAt);
  sendSuccess(
    res,
    {
      user: result.user,
      accessToken: result.session.accessToken,
      expiresIn: result.session.expiresIn,
    },
    { status },
  );
}

const refreshTokenOf = (req: Request): string | undefined => {
  const value: unknown = req.cookies?.[REFRESH_COOKIE];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

export const providers: RequestHandler = (_req, res) => {
  sendSuccess(res, { google: googleProvider.configured });
};

export const register: RequestHandler = async (req, res) => {
  const { body } = getValidated<{ body: RegisterBody }>(res);
  respondWithSession(res, await authService.register(body, deviceOf(req)), 201);
};

export const login: RequestHandler = async (req, res) => {
  const { body } = getValidated<{ body: LoginBody }>(res);
  respondWithSession(res, await authService.login(body, deviceOf(req)));
};

export const refresh: RequestHandler = async (req, res) => {
  const token = refreshTokenOf(req);
  if (!token) throw unauthorized('Your session has ended. Sign in again.');
  try {
    respondWithSession(res, await authService.refresh(token, deviceOf(req)));
  } catch (error) {
    // A refresh token that fails is dead, so stop the browser from sending it again.
    clearRefreshCookie(res);
    throw error;
  }
};

export const logout: RequestHandler = async (req, res) => {
  await authService.logout(refreshTokenOf(req));
  clearRefreshCookie(res);
  sendNoContent(res);
};

export const logoutAll: RequestHandler = async (req, res) => {
  const { userId } = requireAuth(req);
  const revoked = await authService.logoutAll(userId);
  clearRefreshCookie(res);
  sendSuccess(res, { revoked });
};

export const me: RequestHandler = async (req, res) => {
  sendSuccess(res, { user: await authService.getUser(requireAuth(req).userId) });
};

export const listSessions: RequestHandler = async (req, res) => {
  const { userId, sessionId } = requireAuth(req);
  sendSuccess(res, await authService.listSessions(userId, sessionId));
};

export const revokeSession: RequestHandler = async (req, res) => {
  const { userId, sessionId: currentSessionId } = requireAuth(req);
  const { params } = getValidated<{ params: { sessionId: string } }>(res);
  await authService.revokeSession(userId, params.sessionId);
  // Removing the device you are using signs you out here too.
  if (params.sessionId === currentSessionId) clearRefreshCookie(res);
  sendNoContent(res);
};

// --- Google sign-in -------------------------------------------------------------------------
// These are browser navigations, not API calls: failures redirect back to the login page with an
// error code instead of returning JSON, and success redirects to the app (which then picks the
// session up through the refresh cookie).

const clientUrl = env.CLIENT_URL[0] ?? '';
const loginRedirect = (error: string) => `${clientUrl}/login?error=${error}`;

export const googleStart: RequestHandler = async (_req, res) => {
  if (!googleProvider.configured) {
    res.redirect(loginRedirect('google_unavailable'));
    return;
  }
  try {
    const { url, state, codeVerifier } = await googleProvider.createAuthorization();
    setOAuthCookie(res, state, codeVerifier);
    res.redirect(url);
  } catch (err) {
    logger.error({ err }, 'Could not start Google sign-in');
    res.redirect(loginRedirect('google_failed'));
  }
};

const sameSecret = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

export const googleCallback: RequestHandler = async (req, res) => {
  const saved = readOAuthCookie(req.cookies?.[OAUTH_COOKIE]);
  clearOAuthCookie(res);

  const { code, state, error } = req.query;
  if (typeof error === 'string') {
    res.redirect(loginRedirect(error === 'access_denied' ? 'google_cancelled' : 'google_failed'));
    return;
  }
  if (
    typeof code !== 'string' ||
    typeof state !== 'string' ||
    !saved ||
    !sameSecret(state, saved.state)
  ) {
    res.redirect(loginRedirect('google_failed'));
    return;
  }

  try {
    const profile = await googleProvider.exchangeCode(code, saved.codeVerifier);
    const result = await authService.loginWithGoogle(profile, deviceOf(req));
    setRefreshCookie(res, result.session.refreshToken, result.session.refreshExpiresAt);
    res.redirect(`${clientUrl}/`);
  } catch (err) {
    logger.warn({ err }, 'Google sign-in failed');
    res.redirect(loginRedirect('google_failed'));
  }
};
