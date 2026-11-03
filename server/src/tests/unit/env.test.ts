import { describe, expect, it } from 'vitest';
import { EnvValidationError, parseEnv } from '../../config/env';

const valid = {
  CLIENT_URL: 'http://localhost:5173',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/test',
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

  it('rejects an out-of-range port', () => {
    expect(() => parseEnv({ ...valid, PORT: '70000' })).toThrow(/PORT/);
  });
});
