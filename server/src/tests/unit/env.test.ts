import { describe, expect, it } from 'vitest';
import { EnvValidationError, parseEnv } from '../../config/env';

const valid = {
  CLIENT_URL: 'http://localhost:5173',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/test',
  ACCESS_TOKEN_SECRET: 'a'.repeat(32),
  REFRESH_TOKEN_SECRET: 'b'.repeat(32),
};

describe('parseEnv', () => {
  it('applies defaults', () => {
    const env = parseEnv(valid);
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 5000,
      LOG_LEVEL: 'info',
      TRUST_PROXY: false,
      CLIENT_URL: ['http://localhost:5173'],
      ACCESS_TOKEN_TTL_MINUTES: 15,
      REFRESH_TOKEN_TTL_DAYS: 7,
      SESSION_MAX_AGE_DAYS: 30,
      COOKIE_SAME_SITE: 'lax',
      COOKIE_SECURE: false,
    });
  });

  it('normalises a comma separated origin list', () => {
    const env = parseEnv({
      ...valid,
      CLIENT_URL: ' http://localhost:5173/ , https://app.example.com/some/path ',
    });
    expect(env.CLIENT_URL).toEqual(['http://localhost:5173', 'https://app.example.com']);
  });

  it('rejects wildcard origins', () => {
    expect(() => parseEnv({ ...valid, CLIENT_URL: '*' })).toThrow(EnvValidationError);
  });

  it('requires the database URI and validates its scheme', () => {
    expect(() => parseEnv({ CLIENT_URL: valid.CLIENT_URL })).toThrow(/MONGODB_URI/);
    expect(() => parseEnv({ ...valid, MONGODB_URI: 'postgres://nope' })).toThrow(/MONGODB_URI/);
  });

  it('parses TRUST_PROXY as a boolean or a hop count', () => {
    expect(parseEnv({ ...valid, TRUST_PROXY: 'true' }).TRUST_PROXY).toBe(true);
    expect(parseEnv({ ...valid, TRUST_PROXY: '2' }).TRUST_PROXY).toBe(2);
    expect(() => parseEnv({ ...valid, TRUST_PROXY: 'maybe' })).toThrow(EnvValidationError);
  });

  it('requires two distinct, long secrets', () => {
    expect(() => parseEnv({ ...valid, ACCESS_TOKEN_SECRET: undefined })).toThrow(
      /ACCESS_TOKEN_SECRET/,
    );
    expect(() => parseEnv({ ...valid, REFRESH_TOKEN_SECRET: 'short' })).toThrow(/at least 32/);
    expect(() => parseEnv({ ...valid, REFRESH_TOKEN_SECRET: valid.ACCESS_TOKEN_SECRET })).toThrow(
      /must differ/,
    );
  });

  it('makes cookies secure by default only in production', () => {
    expect(parseEnv({ ...valid, NODE_ENV: 'production' }).COOKIE_SECURE).toBe(true);
    expect(
      parseEnv({ ...valid, NODE_ENV: 'production', COOKIE_SECURE: 'false' }).COOKIE_SECURE,
    ).toBe(false);
    expect(parseEnv({ ...valid, NODE_ENV: 'development' }).COOKIE_SECURE).toBe(false);
  });

  it('refuses SameSite=None without a secure cookie', () => {
    expect(() => parseEnv({ ...valid, COOKIE_SAME_SITE: 'none' })).toThrow(
      /requires COOKIE_SECURE/,
    );
    expect(
      parseEnv({ ...valid, COOKIE_SAME_SITE: 'none', COOKIE_SECURE: 'true' }).COOKIE_SAME_SITE,
    ).toBe('none');
  });

  it('accepts Google settings only when all three are present', () => {
    expect(() => parseEnv({ ...valid, GOOGLE_CLIENT_ID: 'id' })).toThrow(/together/);
    const env = parseEnv({
      ...valid,
      GOOGLE_CLIENT_ID: 'id',
      GOOGLE_CLIENT_SECRET: 'secret',
      GOOGLE_CALLBACK_URL: 'http://localhost:5000/api/v1/auth/google/callback',
    });
    expect(env.GOOGLE_CLIENT_ID).toBe('id');
    expect(parseEnv({ ...valid, GOOGLE_CLIENT_ID: '' }).GOOGLE_CLIENT_ID).toBeUndefined();
  });

  it('rejects an out-of-range port', () => {
    expect(() => parseEnv({ ...valid, PORT: '70000' })).toThrow(/PORT/);
  });
});
