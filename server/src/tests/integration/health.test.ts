import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../app';

const app = createApp();

describe('GET /api/v1/health', () => {
  it('reports liveness inside the standard envelope', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ status: 'ok', database: { state: 'disconnected' } });
    expect(typeof res.body.data.uptimeSeconds).toBe('number');
    expect(typeof res.body.data.timestamp).toBe('string');
  });

  it('adds a request id header', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.headers['x-request-id']).toMatch(/^[\w-]{8,64}$/);
  });

  it('reuses a well-formed incoming request id and ignores a malformed one', async () => {
    const good = await request(app).get('/api/v1/health').set('X-Request-Id', 'trace-abc-12345');
    expect(good.headers['x-request-id']).toBe('trace-abc-12345');

    const bad = await request(app).get('/api/v1/health').set('X-Request-Id', 'bad id with spaces!');
    expect(bad.headers['x-request-id']).not.toBe('bad id with spaces!');
  });
});

describe('GET /api/v1/health/ready', () => {
  it('returns 503 while the database is not connected', async () => {
    const res = await request(app).get('/api/v1/health/ready');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: 'SERVICE_UNAVAILABLE' },
    });
  });
});
