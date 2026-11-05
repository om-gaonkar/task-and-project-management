import type { AccessTokenClaims } from '../../modules/auth/tokens';

declare global {
  namespace Express {
    interface Request {
      /** Set by the authenticate middleware on routes that require a signed-in user. */
      auth?: AccessTokenClaims;
    }
  }
}

export {};
