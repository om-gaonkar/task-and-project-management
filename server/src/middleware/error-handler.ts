import type { ErrorRequestHandler } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { logger } from '../config/logger';
import { AppError } from '../shared/errors/app-error';

interface NormalizedError {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

function isDuplicateKeyError(
  err: unknown,
): err is { code: number; keyValue?: Record<string, unknown> } {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 11000;
}

function bodyParserErrorType(err: unknown): string | null {
  if (typeof err !== 'object' || err === null) return null;
  const type = (err as { type?: unknown }).type;
  return typeof type === 'string' && type.startsWith('entity.') ? type : null;
}

export function normalizeError(err: unknown): NormalizedError {
  if (err instanceof AppError) {
    return {
      statusCode: err.statusCode,
      code: err.code,
      message: err.message,
      details: err.details,
    };
  }

  if (err instanceof ZodError) {
    return {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    };
  }

  if (err instanceof mongoose.Error.ValidationError) {
    return {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: Object.values(err.errors).map((e) => ({ path: e.path, message: e.message })),
    };
  }

  if (err instanceof mongoose.Error.CastError) {
    return { statusCode: 400, code: 'INVALID_ID', message: `Invalid value for "${err.path}"` };
  }

  if (isDuplicateKeyError(err)) {
    return {
      statusCode: 409,
      code: 'CONFLICT',
      message: 'A record with these values already exists',
      details: { fields: Object.keys(err.keyValue ?? {}) },
    };
  }

  const parserType = bodyParserErrorType(err);
  if (parserType === 'entity.parse.failed') {
    return { statusCode: 400, code: 'INVALID_JSON', message: 'Request body is not valid JSON' };
  }
  if (parserType === 'entity.too.large') {
    return { statusCode: 413, code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' };
  }
  if (parserType) {
    return { statusCode: 400, code: 'BAD_REQUEST', message: 'Request body could not be read' };
  }

  // Anything else is a bug or an infrastructure failure. Never leak its message to the client.
  return { statusCode: 500, code: 'INTERNAL_ERROR', message: 'Something went wrong on our side' };
}

/** Must keep four parameters so Express recognises it as an error handler. */
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const normalized = normalizeError(err);
  const log = req.log ?? logger;
  if (normalized.statusCode >= 500) {
    log.error({ err }, 'Unhandled error');
  }

  res.status(normalized.statusCode).json({
    success: false,
    error: {
      code: normalized.code,
      message: normalized.message,
      ...(normalized.details !== undefined ? { details: normalized.details } : {}),
      requestId: req.id,
    },
  });
};
