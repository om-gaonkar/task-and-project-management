import type { CorsOptions } from 'cors';
import { env } from './env';

/**
 * Explicit origin allowlist with credentials. A wildcard is never emitted, which browsers would
 * reject for credentialed requests anyway. Note that CORS is not CSRF protection; the CSRF
 * middleware arrives with authentication in phase 2.
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
    allowedHeaders: ['Content-Type', 'Accept', 'X-CSRF-Token', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 600,
  };
}

export const corsOptions = buildCorsOptions(env.CLIENT_URL);
