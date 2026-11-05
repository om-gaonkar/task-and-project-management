import type { Request } from 'express';
import rateLimit from 'express-rate-limit';
import { tooManyRequests } from '../shared/errors/app-error';

interface RateLimiterOptions {
  windowMs: number;
  limit: number;
  message?: string;
  /** Count only failed requests (status >= 400), so normal use never hits the limit. */
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

/**
 * Factory so auth endpoints can get much stricter limits than the general API.
 * Counters live in memory, so with more than one server instance each instance counts alone.
 * Move to a shared store (for example Redis) when the API is scaled out.
 */
export function createRateLimiter({
  windowMs,
  limit,
  message,
  skipSuccessfulRequests,
  keyGenerator,
}: RateLimiterOptions) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests,
    ...(keyGenerator ? { keyGenerator } : {}),
    handler: (_req, _res, next) => next(tooManyRequests(message)),
  });
}

/** Broad per-IP ceiling for the whole API; health checks are mounted before it. */
export const apiLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, limit: 600 });
