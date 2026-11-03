import type { RequestHandler, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { validationError } from '../shared/errors/app-error';

type Location = 'params' | 'query' | 'body';
type Schemas = Partial<Record<Location, ZodTypeAny>>;

export interface ValidationIssue {
  location: Location;
  path: string;
  message: string;
}

/**
 * Validates untrusted input with Zod. Parsed values (coerced, defaulted, unknown keys stripped)
 * are stored on res.locals instead of being written back to req, because req.query is a
 * read-only getter in Express 5. Read them in controllers with getValidated().
 */
export function validate(schemas: Schemas): RequestHandler {
  return (req, res, next) => {
    const issues: ValidationIssue[] = [];
    const parsed: Partial<Record<Location, unknown>> = {};

    for (const location of ['params', 'query', 'body'] as const) {
      const schema = schemas[location];
      if (!schema) continue;
      const input = location === 'body' ? (req.body ?? {}) : req[location];
      const result = schema.safeParse(input);
      if (result.success) {
        parsed[location] = result.data;
      } else {
        for (const issue of result.error.issues) {
          issues.push({ location, path: issue.path.join('.'), message: issue.message });
        }
      }
    }

    if (issues.length > 0) {
      next(validationError(issues));
      return;
    }
    res.locals.validated = parsed;
    next();
  };
}

export function getValidated<T extends Partial<Record<Location, unknown>>>(res: Response): T {
  return (res.locals.validated ?? {}) as T;
}
