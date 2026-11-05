import type { CorsOptions } from 'cors';
import { env } from './env';

/**
 * Explicit origin allowlist with credentials. A wildcard is never emitted, which browsers would
 * reject for credentialed requests anyway. CORS is not CSRF protection by itself; the cookie
 * routes add middleware/csrf.ts on top of it.
 */
export function buildCorsOptions(allowedOrigins: readonly string[]): CorsOptions {
  const allowed = new Set(allowedOrigins);
  return {
    origin(origin, callback) {
      // Requests without an Origin header are not cross-origin browser requests (curl, health checks).
      if (!origin || allowed.has(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'X-CSRF-Token', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 600,
  };
}

export const corsOptions = buildCorsOptions(env.CLIENT_URL);
