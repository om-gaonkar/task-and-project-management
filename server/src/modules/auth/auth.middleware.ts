import type { Request, RequestHandler } from 'express';
import { unauthorized } from '../../shared/errors/app-error';
import type { AuthService } from './auth.service';
import type { AccessTokenClaims } from './tokens';

const BEARER = /^Bearer\s+(\S+)$/i;

/** Requires a valid access token in the Authorization header and exposes it as req.auth. */
export function createAuthenticate(service: Pick<AuthService, 'authenticate'>): RequestHandler {
  return async (req, _res, next) => {
    const token = BEARER.exec(req.get('authorization') ?? '')?.[1];
    if (!token) {
      next(unauthorized('Authentication required'));
      return;
    }
    try {
      req.auth = await service.authenticate(token);
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** For handlers behind authenticate: narrows req.auth so controllers never handle undefined. */
export function requireAuth(req: Request): AccessTokenClaims {
  if (!req.auth) throw unauthorized('Authentication required');
  return req.auth;
}
