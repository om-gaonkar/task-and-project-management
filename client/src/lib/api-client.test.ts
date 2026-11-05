import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, setAuthHooks } from './api-client';

type FetchArgs = [RequestInfo | URL, RequestInit | undefined];

function stubFetch(result: () => Promise<Response>) {
  const fetchMock = vi.fn(async (..._args: FetchArgs) => result());
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => {
  vi.unstubAllGlobals();
  setAuthHooks({ getAccessToken: () => null, refresh: async () => null });
});

describe('api client', () => {
  it('unwraps the success envelope and sends cookies', async () => {
    const fetchMock = stubFetch(async () => json({ success: true, data: { hello: 'world' } }));

    await expect(api.get('/ping')).resolves.toEqual({ hello: 'world' });

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.credentials).toBe('include');
    expect(init?.method).toBe('GET');
  });

  it('builds the query string and skips empty values', async () => {
    const fetchMock = stubFetch(async () => json({ success: true, data: [] }));

    await api.get('/tasks', { query: { limit: 5, status: undefined, q: '', done: false } });

    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/tasks\?limit=5&done=false$/);
  });

  it('sends JSON bodies with a content type', async () => {
    const fetchMock = stubFetch(async () => json({ success: true, data: { id: '1' } }, 201));

    await api.post('/tasks', { title: 'Write tests' });

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(JSON.stringify({ title: 'Write tests' }));
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('turns an error envelope into an ApiError', async () => {
    stubFetch(async () =>
      json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Task not found', requestId: 'req-1' },
        },
        404,
      ),
    );

    const error = await api.get('/tasks/1').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
      message: 'Task not found',
      requestId: 'req-1',
    });
  });

  it('falls back to a generic error when the body is not an envelope', async () => {
    stubFetch(async () => new Response('<html>Bad gateway</html>', { status: 502 }));

    await expect(api.get('/ping')).rejects.toMatchObject({ status: 502, code: 'HTTP_502' });
  });

  it('reports network failures with status 0', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch');
    });

    await expect(api.get('/ping')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('resolves undefined for 204 responses', async () => {
    stubFetch(async () => new Response(null, { status: 204 }));

    await expect(api.delete('/tasks/1')).resolves.toBeUndefined();
  });

  it('rejects a 200 response that is not in the envelope format', async () => {
    stubFetch(async () => json({ unexpected: true }));

    await expect(api.get('/ping')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('sends the CSRF header on writes but not on reads', async () => {
    const fetchMock = stubFetch(async () => json({ success: true, data: {} }));

    await api.get('/things');
    await api.post('/things', {});
    await api.delete('/things/1');

    const headers = fetchMock.mock.calls.map(([, init]) => init?.headers as Record<string, string>);
    expect(headers[0]['X-CSRF-Token']).toBeUndefined();
    expect(headers[1]['X-CSRF-Token']).toBe('1');
    expect(headers[2]['X-CSRF-Token']).toBe('1');
  });

  it('attaches the bearer token unless the call opts out', async () => {
    setAuthHooks({ getAccessToken: () => 'secret-token', refresh: async () => null });
    const fetchMock = stubFetch(async () => json({ success: true, data: {} }));

    await api.get('/things');
    await api.post('/auth/login', {}, { skipAuth: true });

    const [signedIn, skipped] = fetchMock.mock.calls.map(
      ([, init]) => init?.headers as Record<string, string>,
    );
    expect(signedIn.Authorization).toBe('Bearer secret-token');
    expect(skipped.Authorization).toBeUndefined();
  });

  it('never tries to refresh a 401 from a skipAuth call', async () => {
    const refresh = vi.fn(async () => 'new-token');
    setAuthHooks({ getAccessToken: () => null, refresh });
    stubFetch(async () =>
      json(
        {
          success: false,
          error: { code: 'UNAUTHENTICATED', message: 'Invalid email or password' },
        },
        401,
      ),
    );

    await expect(api.post('/auth/login', {}, { skipAuth: true })).rejects.toMatchObject({
      status: 401,
    });
    expect(refresh).not.toHaveBeenCalled();
  });
});
