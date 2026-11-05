import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { csrfGuard } from '../../middleware/csrf';
import { errorHandler } from '../../middleware/error-handler';

const app = express();
app.use(csrfGuard(['https://app.example.com']));
app.get('/thing', (_req, res) => void res.json({ ok: true }));
app.post('/thing', (_req, res) => void res.json({ ok: true }));
app.use(errorHandler);

describe('csrfGuard', () => {
  it('lets safe methods through without any header', async () => {
    await request(app).get('/thing').expect(200);
    await request(app).get('/thing').set('Origin', 'https://evil.example').expect(200);
  });

  it('rejects a state-changing request from an origin outside the allowlist', async () => {
    const res = await request(app)
      .post('/thing')
      .set('Origin', 'https://evil.example')
      .set('X-CSRF-Token', '1');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_REJECTED');
  });

  it('rejects the "null" origin used by sandboxed pages', async () => {
    await request(app).post('/thing').set('Origin', 'null').set('X-CSRF-Token', '1').expect(403);
  });

  it('rejects a state-changing request without the custom header', async () => {
    const res = await request(app).post('/thing').set('Origin', 'https://app.example.com');
    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/header/i);
  });

  it('accepts an allowlisted origin with the header, and non-browser clients with the header', async () => {
    await request(app)
      .post('/thing')
      .set('Origin', 'https://app.example.com')
      .set('X-CSRF-Token', '1')
      .expect(200);
    await request(app).post('/thing').set('X-CSRF-Token', '1').expect(200);
  });
});
