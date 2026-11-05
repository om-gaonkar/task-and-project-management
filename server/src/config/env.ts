import 'dotenv/config';
import { z } from 'zod';

/**
 * Turns "http://localhost:5173, https://app.example.com" into a list of exact origins.
 * Wildcards and non-http(s) values are rejected so credentialed CORS can never be opened up by accident.
 */
const clientOrigins = z
  .string({ required_error: 'CLIENT_URL is required' })
  .transform((value, ctx) => {
    const origins: string[] = [];
    for (const raw of value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)) {
      try {
        const url = new URL(raw);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('protocol');
        origins.push(url.origin);
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid origin "${raw}". Use full origins such as http://localhost:5173 (wildcards are not allowed).`,
        });
        return z.NEVER;
      }
    }
    if (origins.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CLIENT_URL must contain at least one origin',
      });
      return z.NEVER;
    }
    return origins;
  });

const trustProxy = z
  .string()
  .default('false')
  .transform((value, ctx): boolean | number => {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'false' || normalized === '0') return false;
    if (normalized === 'true') return true;
    if (/^\d+$/.test(normalized)) return Number(normalized);
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'TRUST_PROXY must be "false", "true" or a number of proxy hops',
    });
    return z.NEVER;
  });

const optionalBoolean = z
  .string()
  .optional()
  .transform((value, ctx): boolean | undefined => {
    if (value === undefined || value.trim() === '') return undefined;
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Must be "true" or "false"' });
    return z.NEVER;
  });

const secret = (name: string) =>
  z
    .string({ required_error: `${name} is required` })
    .min(32, `${name} must be at least 32 characters. Generate one with: openssl rand -base64 48`);

const optionalString = z
  .string()
  .optional()
  .transform((value) => (value && value.trim() !== '' ? value.trim() : undefined));

const envObject = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  CLIENT_URL: clientOrigins,
  MONGODB_URI: z
    .string({ required_error: 'MONGODB_URI is required' })
    .regex(/^mongodb(\+srv)?:\/\//, 'MONGODB_URI must start with mongodb:// or mongodb+srv://'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  TRUST_PROXY: trustProxy,

  // --- Authentication ---
  ACCESS_TOKEN_SECRET: secret('ACCESS_TOKEN_SECRET'),
  REFRESH_TOKEN_SECRET: secret('REFRESH_TOKEN_SECRET'),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().min(1).max(60).default(15),
  /** Sliding lifetime: every rotation issues a refresh token valid for this many days. */
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  /** Hard cap on one login session, however often it is refreshed. */
  SESSION_MAX_AGE_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  /** Defaults to true in production and false elsewhere. */
  COOKIE_SECURE: optionalBoolean,
  /** lax for same-site deployments (app.example.com + api.example.com), none for cross-site. */
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),

  // --- Google sign-in (optional: set all three or none) ---
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  GOOGLE_CALLBACK_URL: optionalString.refine(
    (value) => value === undefined || /^https?:\/\//.test(value),
    'GOOGLE_CALLBACK_URL must be a full http(s) URL',
  ),
});

const envSchema = envObject
  .superRefine((value, ctx) => {
    if (value.ACCESS_TOKEN_SECRET === value.REFRESH_TOKEN_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['REFRESH_TOKEN_SECRET'],
        message: 'REFRESH_TOKEN_SECRET must differ from ACCESS_TOKEN_SECRET',
      });
    }
    const google = [value.GOOGLE_CLIENT_ID, value.GOOGLE_CLIENT_SECRET, value.GOOGLE_CALLBACK_URL];
    if (google.some(Boolean) && !google.every(Boolean)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['GOOGLE_CLIENT_ID'],
        message:
          'Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_CALLBACK_URL together, or none of them',
      });
    }
  })
  .transform((value) => {
    const cookieSecure = value.COOKIE_SECURE ?? value.NODE_ENV === 'production';
    return { ...value, COOKIE_SECURE: cookieSecure };
  })
  .superRefine((value, ctx) => {
    if (value.COOKIE_SAME_SITE === 'none' && !value.COOKIE_SECURE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['COOKIE_SAME_SITE'],
        message: 'COOKIE_SAME_SITE=none requires COOKIE_SECURE=true (browsers reject it otherwise)',
      });
    }
  });

export type Env = z.output<typeof envSchema>;

export class EnvValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvValidationError';
  }
}

/** Pure parser so tests can exercise it without touching process.env. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map(
      (issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
    throw new EnvValidationError(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  return result.data;
}

function loadEnv(): Env {
  try {
    return parseEnv(process.env);
  } catch (error) {
    if (error instanceof EnvValidationError) {
      // The logger depends on env, so this is the one place that writes to the console directly.
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
}

export const env = loadEnv();
export const isProduction = env.NODE_ENV === 'production';
