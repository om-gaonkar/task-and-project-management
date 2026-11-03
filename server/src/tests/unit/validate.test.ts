import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { errorHandler } from '../../middleware/error-handler';
import { getValidated, validate } from '../../middleware/validate';

const app = express();
app.use(express.json());
app.post(
  '/items/:id',
  validate({
    params: z.object({ id: z.string().regex(/^\d+$/, 'id must be numeric') }),
    query: z.object({ limit: z.coerce.number().int().min(1).default(10) }),
    body: z.object({ title: z.string().min(1, 'title is required') }),
  }),
  (_req, res) => {
    const { query, body } = getValidated<{ query: { limit: number }; body: { title: string } }>(
      res,
    );
    res.json({ limit: query.limit, title: body.title });
  },
);
app.use(errorHandler);

describe('validate middleware', () => {
  it('passes coerced and defaulted values to the handler', async () => {
    const res = await request(app)
      .post('/items/42')
      .send({ title: 'Write tests', extra: 'dropped' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ limit: 10, title: 'Write tests' });

    const withLimit = await request(app).post('/items/42?limit=5').send({ title: 'x' });
    expect(withLimit.body.limit).toBe(5);
  });

  it('reports every invalid location with its path', async () => {
    const res = await request(app).post('/items/abc?limit=0').send({ title: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ location: 'params', path: 'id' }),
        expect.objectContaining({ location: 'query', path: 'limit' }),
        expect.objectContaining({ location: 'body', path: 'title' }),
      ]),
    );
  });

  it('treats a missing body as an empty object', async () => {
    const res = await request(app).post('/items/1');
    expect(res.status).toBe(400);
    expect(res.body.error.details[0]).toMatchObject({ location: 'body', path: 'title' });
  });
});
