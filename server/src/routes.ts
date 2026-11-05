import { Router, type Express } from 'express';
import { apiLimiter } from './middleware/rate-limiter';
import { authRouter } from './modules/auth/auth.routes';
import { healthRouter } from './modules/health/health.routes';
import { API_PREFIX } from './shared/constants';

/** Feature routers are mounted here as each phase adds its module (auth, tasks, projects, ...). */
const apiRouter = Router();
apiRouter.use('/auth', authRouter);

export function registerRoutes(app: Express): void {
  // Health checks stay outside the rate limiter so orchestrators can poll freely.
  app.use(`${API_PREFIX}/health`, healthRouter);
  app.use(API_PREFIX, apiLimiter, apiRouter);
}
