import { Router, type Request, type RequestHandler } from 'express';
import { env } from '../../config/env';
import { csrfGuard } from '../../middleware/csrf';
import { createRateLimiter } from '../../middleware/rate-limiter';
import { validate } from '../../middleware/validate';
import { createAuthenticate } from './auth.middleware';
import { authService } from './auth.container';
import {
  googleCallback,
  googleStart,
  listSessions,
  login,
  logout,
  logoutAll,
  me,
  providers,
  refresh,
  register,
  revokeSession,
} from './auth.controller';
import { loginSchema, registerSchema, sessionParamsSchema } from './auth.schemas';

const emailOf = (req: Request): string => {
  const email: unknown = req.body?.email;
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
};

// Keyed by IP and email, so one attacker cannot lock a victim out from another address, and a
// shared office IP is not blocked by one person's typos. Only failures count.
const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${req.ip ?? 'unknown'}:${emailOf(req)}`,
  message: 'Too many sign-in attempts. Try again in a few minutes.',
});

const registerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  message: 'Too many accounts created from this network. Try again later.',
});

const refreshLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, limit: 120 });

const noStore: RequestHandler = (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
};

const authenticate = createAuthenticate(authService);

export const authRouter = Router();

authRouter.use(noStore);

// Public and safe (GET): provider discovery and the two Google browser redirects.
authRouter.get('/providers', providers);
authRouter.get('/google', googleStart);
authRouter.get('/google/callback', googleCallback);

// Everything below changes state or hands out credentials, so it needs the CSRF guard.
authRouter.use(csrfGuard(env.CLIENT_URL));

authRouter.post('/register', registerLimiter, validate({ body: registerSchema }), register);
authRouter.post('/login', loginLimiter, validate({ body: loginSchema }), login);
authRouter.post('/refresh', refreshLimiter, refresh);
authRouter.post('/logout', logout);

authRouter.get('/me', authenticate, me);
authRouter.get('/sessions', authenticate, listSessions);
authRouter.delete(
  '/sessions/:sessionId',
  authenticate,
  validate({ params: sessionParamsSchema }),
  revokeSession,
);
authRouter.post('/logout-all', authenticate, logoutAll);
