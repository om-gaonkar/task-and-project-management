/**
 * Operational error with an HTTP status and a stable machine-readable code.
 * Throw these from services; the central error handler turns them into the response envelope.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message = 'Bad request', details?: unknown) =>
  new AppError(400, 'BAD_REQUEST', message, details);

export const validationError = (details: unknown) =>
  new AppError(400, 'VALIDATION_ERROR', 'Request validation failed', details);

export const unauthorized = (message = 'Authentication required') =>
  new AppError(401, 'UNAUTHENTICATED', message);

export const forbidden = (message = 'You do not have access to this resource') =>
  new AppError(403, 'FORBIDDEN', message);

/** Also use this when a record exists but belongs to another user, so ids cannot be probed. */
export const notFound = (message = 'Resource not found') => new AppError(404, 'NOT_FOUND', message);

export const conflict = (message = 'Conflict with the current state', details?: unknown) =>
  new AppError(409, 'CONFLICT', message, details);

export const tooManyRequests = (message = 'Too many requests, please try again later') =>
  new AppError(429, 'RATE_LIMITED', message);

export const serviceUnavailable = (message = 'Service temporarily unavailable') =>
  new AppError(503, 'SERVICE_UNAVAILABLE', message);
