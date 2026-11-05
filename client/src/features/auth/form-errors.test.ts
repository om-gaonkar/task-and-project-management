import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api-client';
import { describeAuthError, describeOAuthError } from './form-errors';

const FIELDS = ['name', 'email', 'password'] as const;

describe('describeAuthError', () => {
  it('puts server validation messages under their inputs, first message per field', () => {
    const error = new ApiError(400, {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: [
        { location: 'body', path: 'email', message: 'Enter a valid email address' },
        { location: 'body', path: 'email', message: 'Email is too long' },
        { location: 'body', path: 'password', message: 'Use at least 10 characters' },
        { location: 'body', path: 'unknown', message: 'ignored' },
      ],
    });
    expect(describeAuthError(error, FIELDS)).toEqual({
      fields: { email: 'Enter a valid email address', password: 'Use at least 10 characters' },
      message: null,
    });
  });

  it('falls back to a form-level message when no issue maps to an input', () => {
    const error = new ApiError(400, { code: 'VALIDATION_ERROR', message: 'x', details: [] });
    expect(describeAuthError(error, FIELDS).message).toMatch(/check the details/i);
  });

  it('points an existing-email conflict at the email input', () => {
    const error = new ApiError(409, { code: 'CONFLICT', message: 'exists' });
    expect(describeAuthError(error, FIELDS).fields.email).toMatch(/already exists/);
  });

  it('shows the server’s own message for credentials, throttling and network problems', () => {
    expect(
      describeAuthError(
        new ApiError(401, { code: 'UNAUTHENTICATED', message: 'Invalid email or password' }),
        FIELDS,
      ),
    ).toEqual({ fields: {}, message: 'Invalid email or password' });
    expect(
      describeAuthError(
        new ApiError(0, { code: 'NETWORK_ERROR', message: 'Could not reach the server.' }),
        FIELDS,
      ).message,
    ).toBe('Could not reach the server.');
  });

  it('does not leak the text of unexpected errors', () => {
    expect(describeAuthError(new Error('TypeError: x is undefined'), FIELDS).message).toBe(
      'Something went wrong. Try again.',
    );
  });
});

describe('describeOAuthError', () => {
  it('translates the codes the API appends and ignores anything else', () => {
    expect(describeOAuthError('google_cancelled')).toMatch(/cancelled/);
    expect(describeOAuthError('google_failed')).toMatch(/did not finish/);
    expect(describeOAuthError('<script>')).toBeNull();
    expect(describeOAuthError(null)).toBeNull();
  });
});
