import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { errorHandler } from '../../middleware/error-handler';
import { conflict, notFound } from '../../shared/errors/app-error';

const app = express();
app.get('/app-error', () => {
  throw notFound('Task not found');
});
app.get('/conflict', () => {
  throw conflict('Version mismatch', { currentVersion: 4 });
});
app.get('/zod', () => {
  z.object({ name: z.string() }).parse({});
});
app.get('/duplicate', () => {
  throw Object.assign(new Error('E11000 duplicate key'), { code: 11000, keyValue: { email: 'x' } });
});
app.get('/unknown', () => {
  throw new Error('connection string mongodb://user:hunter2@host');
});
app.use(errorHandler);

describe('errorHandler', () => {
  it('maps AppError to its status, code and message', async () => {
    const res = await request(app).get('/app-error');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Task not found' },
    });
  });

  it('includes details when an error carries them', async () => {
    const res = await request(app).get('/conflict');
    expect(res.status).toBe(409);
    expect(res.body.error.details).toEqual({ currentVersion: 4 });
  });

  it('maps ZodError to a validation error', async () => {
    const res = await request(app).get('/zod');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0].path).toBe('name');
  });

  it('maps MongoDB duplicate key errors to 409', async () => {
    const res = await request(app).get('/duplicate');
    expect(res.status).toBe(409);
    expect(res.body.error.details).toEqual({ fields: ['email'] });
  });

  it('hides the message of unexpected errors', async () => {
    const res = await request(app).get('/unknown');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('hunter2');
  });
});
