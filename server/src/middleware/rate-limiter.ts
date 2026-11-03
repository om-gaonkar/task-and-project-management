import rateLimit from 'express-rate-limit';
import { tooManyRequests } from '../shared/errors/app-error';

interface RateLimiterOptions {
  windowMs: number;
  limit: number;
  message?: string;
}

/** Factory so auth endpoints can later get much stricter limits than the general API. */
export function createRateLimiter({ windowMs, limit, message }: RateLimiterOptions) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, _res, next) => next(tooManyRequests(message)),
  });
}

/** Broad per-IP ceiling for the whole API; health checks are mounted before it. */
export const apiLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, limit: 600 });
