import type { CookieOptions, Response } from 'express';
import { env } from '../../config/env';
import { API_PREFIX } from '../../shared/constants';

export const REFRESH_COOKIE = 'daybook_refresh';
export const OAUTH_COOKIE = 'daybook_oauth';

const AUTH_PATH = `${API_PREFIX}/auth`;
const OAUTH_MAX_AGE_MS = 10 * 60 * 1000;

/**
 * The refresh token lives only in this cookie: httpOnly (scripts cannot read it) and scoped to
 * the auth routes, so it is not sent along with ordinary API calls.
 */
function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    path: AUTH_PATH,
  };
}

export function setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(REFRESH_COOKIE, token, {
    ...refreshCookieOptions(),
    maxAge: Math.max(expiresAt.getTime() - Date.now(), 0),
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
}

/**
 * Holds the OAuth state and PKCE verifier between the redirect to Google and the callback.
 * Always lax: Google sends the browser back with a top-level navigation, which lax allows,
 * and it must never be sent on cross-site subrequests.
 */
function oauthCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    path: `${AUTH_PATH}/google`,
  };
}

export function setOAuthCookie(res: Response, state: string, codeVerifier: string): void {
  res.cookie(OAUTH_COOKIE, `${state}.${codeVerifier}`, {
    ...oauthCookieOptions(),
    maxAge: OAUTH_MAX_AGE_MS,
  });
}

export function clearOAuthCookie(res: Response): void {
  res.clearCookie(OAUTH_COOKIE, oauthCookieOptions());
}

export function readOAuthCookie(value: unknown): { state: string; codeVerifier: string } | null {
  if (typeof value !== 'string') return null;
  const [state, codeVerifier, extra] = value.split('.');
  if (!state || !codeVerifier || extra !== undefined) return null;
  return { state, codeVerifier };
}
