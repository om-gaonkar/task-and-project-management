import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../app';

/**
 * These cover everything that is decided before the database is touched: CSRF, validation,
 * authentication of the bearer token, redirects and headers. Flows that need stored sessions are
 * covered by auth.service.test.ts against in-memory repositories.
 */
const app = createApp();
const ORIGIN = 'http://localhost:5173';
const csrf = { Origin: ORIGIN, 'X-CSRF-Token': '1' };

describe('POST /api/v1/auth/* CSRF protection', () => {
  it('rejects a login from a foreign origin before anything else', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'https://evil.example')
      .set('X-CSRF-Token', '1')
      .send({ email: 'ada@example.com', password: 'whatever' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_REJECTED');
  });

  it('rejects a refresh without the custom header', async () => {
    const res = await request(app).post('/api/v1/auth/refresh').set('Origin', ORIGIN);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_REJECTED');
  });

  it('answers the preflight for the headers the client sends', async () => {
    const res = await request(app)
      .options('/api/v1/auth/refresh')
      .set('Origin', ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type,x-csrf-token');
    expect(res.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(res.headers['access-control-allow-headers']?.toLowerCase()).toContain('authorization');
    expect(res.headers['access-control-allow-headers']?.toLowerCase()).toContain('x-csrf-token');
  });
});

describe('validation', () => {
  it('rejects a bad registration with a message per field', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set(csrf)
      .send({ name: '  ', email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const paths = res.body.error.details.map((issue: { path: string }) => issue.path).sort();
    expect(paths).toEqual(['email', 'name', 'password']);
  });

  it('rejects a login without a password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set(csrf)
      .send({ email: 'ada@example.com' });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0]).toMatchObject({ location: 'body', path: 'password' });
  });
});

describe('cookie-authenticated routes without a cookie', () => {
  it('refuses to refresh and tells the browser to drop nothing it does not have', async () => {
    const res = await request(app).post('/api/v1/auth/refresh').set(csrf);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('signs out successfully and clears the cookie either way', async () => {
    const res = await request(app).post('/api/v1/auth/logout').set(csrf);
    expect(res.status).toBe(204);
    const cookie = res.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toMatch(/^daybook_refresh=;/);
    expect(cookie).toContain('Path=/api/v1/auth');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toMatch(/SameSite=Lax/i);
  });
});

describe('bearer-authenticated routes', () => {
  const protectedRoutes = [
    ['get', '/api/v1/auth/me'],
    ['get', '/api/v1/auth/sessions'],
    ['post', '/api/v1/auth/logout-all'],
    ['delete', `/api/v1/auth/sessions/${'a'.repeat(32)}`],
  ] as const;

  it.each(protectedRoutes)('%s %s needs a token', async (method, path) => {
    const res = await request(app)[method](path).set(csrf);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a token signed with the wrong secret', async () => {
    const forged = jwt.sign({ sid: 's' }, 'z'.repeat(40), {
      subject: 'u',
      issuer: 'daybook-api',
      audience: 'daybook-web',
    });
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid access token');
  });

  it('reports an expired token with its own code', async () => {
    const expired = jwt.sign({ sid: 's' }, process.env.ACCESS_TOKEN_SECRET!, {
      subject: 'u',
      issuer: 'daybook-api',
      audience: 'daybook-web',
      expiresIn: -10,
    });
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('ACCESS_TOKEN_EXPIRED');
  });
});

describe('providers and Google redirects', () => {
  it('reports Google as not configured in this environment', async () => {
    const res = await request(app).get('/api/v1/auth/providers');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ google: false });
  });

  it('sends the browser back to the login page when Google is unavailable', async () => {
    const res = await request(app).get('/api/v1/auth/google');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${ORIGIN}/login?error=google_unavailable`);
  });

  it('rejects a callback that has no matching state cookie', async () => {
    const res = await request(app).get('/api/v1/auth/google/callback?code=abc&state=forged');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${ORIGIN}/login?error=google_failed`);
    expect(res.headers['set-cookie']?.[0]).toMatch(/^daybook_oauth=;/);
  });

  it('reports a cancelled Google prompt separately', async () => {
    const res = await request(app).get('/api/v1/auth/google/callback?error=access_denied');
    expect(res.headers.location).toBe(`${ORIGIN}/login?error=google_cancelled`);
  });
});

describe('response headers', () => {
  it('never lets credentials responses be cached', async () => {
    const res = await request(app).get('/api/v1/auth/providers');
    expect(res.headers['cache-control']).toBe('no-store');
  });
});

describe('sign-in throttling', () => {
  it('stops repeated failed attempts for one email and address', async () => {
    const attempt = () =>
      request(app).post('/api/v1/auth/login').set(csrf).send({ email: 'throttle@example.com' });
    const statuses: number[] = [];
    for (let i = 0; i < 11; i += 1) statuses.push((await attempt()).status);

    expect(statuses.slice(0, 10).every((status) => status === 400)).toBe(true);
    expect(statuses[10]).toBe(429);

    const other = await request(app)
      .post('/api/v1/auth/login')
      .set(csrf)
      .send({ email: 'someone-else@example.com' });
    expect(other.status).toBe(400);
  });
});
