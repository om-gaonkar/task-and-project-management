import { ApiError } from '@/lib/api-client';

export interface AuthErrorResult<F extends string> {
  /** Messages that belong under a specific input. */
  fields: Partial<Record<F, string>>;
  /** A message for the whole form, when nothing points at one input. */
  message: string | null;
}

/**
 * Turns a failed auth request into text for the form. The server sends friendly messages for
 * credentials, throttling and disabled accounts, so those are shown as they are.
 */
export function describeAuthError<F extends string>(
  error: unknown,
  knownFields: readonly F[],
): AuthErrorResult<F> {
  if (!(error instanceof ApiError)) {
    return { fields: {}, message: 'Something went wrong. Try again.' };
  }

  if (error.code === 'VALIDATION_ERROR' && Array.isArray(error.details)) {
    const fields: Partial<Record<F, string>> = {};
    for (const issue of error.details as unknown[]) {
      if (typeof issue !== 'object' || issue === null) continue;
      const { path, message } = issue as { path?: unknown; message?: unknown };
      if (typeof path !== 'string' || typeof message !== 'string') continue;
      const field = knownFields.find((name) => name === path);
      if (field && !(field in fields)) fields[field] = message;
    }
    return Object.keys(fields).length > 0
      ? { fields, message: null }
      : { fields: {}, message: 'Check the details you entered and try again.' };
  }

  const email = knownFields.find((name) => name === 'email');
  if (error.code === 'CONFLICT' && email) {
    return {
      fields: { [email]: 'An account with this email already exists. Sign in instead.' } as Partial<
        Record<F, string>
      >,
      message: null,
    };
  }

  return { fields: {}, message: error.message };
}

const OAUTH_ERRORS: Record<string, string> = {
  google_failed: 'Google sign-in did not finish. Try again, or use your email and password.',
  google_cancelled: 'Google sign-in was cancelled.',
  google_unavailable: 'Google sign-in is not set up for this workspace.',
};

/** Maps the ?error= code the API appends when it sends the browser back from Google. */
export function describeOAuthError(code: string | null): string | null {
  return code ? (OAUTH_ERRORS[code] ?? null) : null;
}
