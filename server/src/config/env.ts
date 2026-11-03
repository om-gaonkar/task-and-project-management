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

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  CLIENT_URL: clientOrigins,
  MONGODB_URI: z
    .string({ required_error: 'MONGODB_URI is required' })
    .regex(/^mongodb(\+srv)?:\/\//, 'MONGODB_URI must start with mongodb:// or mongodb+srv://'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  TRUST_PROXY: trustProxy,
});

export type Env = z.infer<typeof envSchema>;

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
