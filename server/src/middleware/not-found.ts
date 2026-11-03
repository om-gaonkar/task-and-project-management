import type { RequestHandler } from 'express';
import { AppError } from '../shared/errors/app-error';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(404, 'ROUTE_NOT_FOUND', `Route ${req.method} ${req.path} not found`));
};
