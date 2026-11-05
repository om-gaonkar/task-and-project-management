import type { RequestHandler } from 'express';
import { AppError } from '../shared/errors/app-error';

export const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence for the cookie-authenticated routes, built for a frontend and API on different
 * origins. Two checks on every state-changing request:
 *
 * 1. If the browser sent an Origin header, it must be on the allowlist. Browsers attach it to
 *    cross-origin POSTs and users' scripts cannot change it.
 * 2. A custom header must be present. A page on another origin cannot add one without a CORS
 *    preflight, and the preflight is refused for origins outside the allowlist.
 *
 * A synchronizer token would not help here: with the API on another domain, the page cannot read
 * the API's cookies, and a token needs a round trip before the very first refresh on page load.
 * Requests with no Origin at all are not browser cross-origin requests (curl, server to server).
 */
export function csrfGuard(allowedOrigins: readonly string[]): RequestHandler {
  const allowed = new Set(allowedOrigins);
  return (req, _res, next) => {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }

    const origin = req.get('origin');
    if (origin !== undefined && !allowed.has(origin)) {
      next(new AppError(403, 'CSRF_REJECTED', 'Request origin is not allowed'));
      return;
    }

    if (!req.get(CSRF_HEADER)) {
      next(new AppError(403, 'CSRF_REJECTED', 'Missing CSRF header'));
      return;
    }

    next();
  };
}
