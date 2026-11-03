import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { corsOptions } from './config/cors';
import { env } from './config/env';
import { errorHandler } from './middleware/error-handler';
import { notFoundHandler } from './middleware/not-found';
import { requestLogger } from './middleware/request-logger';
import { registerRoutes } from './routes';

/** Builds the Express app without connecting to anything, so tests can import it freely. */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(requestLogger);
  app.use(helmet());
  app.use(cors(corsOptions));
  // Small default body limit. Routes that legitimately need more (diary content) raise it locally.
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  registerRoutes(app);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
