import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createAuthenticate, requireAuth } from '../../modules/auth/auth.middleware';
import { errorHandler } from '../../middleware/error-handler';
import { AppError } from '../../shared/errors/app-error';

function build(authenticate: (token: string) => Promise<{ userId: string; sessionId: string }>) {
  const app = express();
  app.get('/private', createAuthenticate({ authenticate }), (req, res) => {
    res.json(requireAuth(req));
  });
  app.use(errorHandler);
  return app;
}

describe('authenticate middleware', () => {
  it('passes the bearer token to the service and exposes the claims', async () => {
    const authenticate = vi.fn(async () => ({ userId: 'u1', sessionId: 's1' }));
    const res = await request(build(authenticate))
      .get('/private')
      .set('Authorization', 'Bearer abc.def.ghi');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ userId: 'u1', sessionId: 's1' });
    expect(authenticate).toHaveBeenCalledWith('abc.def.ghi');
  });

  it.each([
    ['no header', undefined],
    ['wrong scheme', 'Basic dXNlcjpwYXNz'],
    ['empty token', 'Bearer '],
    ['two tokens', 'Bearer a b'],
  ])('answers 401 for %s without calling the service', async (_name, header) => {
    const authenticate = vi.fn();
    const req = request(build(authenticate)).get('/private');
    const res = await (header ? req.set('Authorization', header) : req);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('forwards the service’s own error code', async () => {
    const authenticate = vi.fn(async () => {
      throw new AppError(401, 'ACCESS_TOKEN_EXPIRED', 'The access token has expired');
    });
    const res = await request(build(authenticate)).get('/private').set('Authorization', 'Bearer x');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('ACCESS_TOKEN_EXPIRED');
  });
});
