import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from '@/lib/api-client';
import { failure, ok, stubApi } from '@/test/fetch-stub';
import { testUser } from '@/test/render';
import { endSession, refreshSession, subscribeToSession, type SessionEvent } from './session';

const session = (accessToken: string) => ok({ user: testUser, accessToken, expiresIn: 900 });

afterEach(() => {
  endSession();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'locks');
});

describe('refreshSession', () => {
  it('stores the access token in memory and announces the person', async () => {
    stubApi({ 'POST /auth/refresh': () => session('tok-1') });
    const events: SessionEvent[] = [];
    subscribeToSession((event) => events.push(event));

    expect(await refreshSession()).toMatchObject({ status: 'ok' });

    expect(events).toEqual([{ type: 'signed-in', user: testUser }]);
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it('shares one request between concurrent callers', async () => {
    const stub = stubApi({
      'POST /auth/refresh': async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return session('tok-1');
      },
    });

    const outcomes = await Promise.all([refreshSession(), refreshSession(), refreshSession()]);

    expect(stub.callsTo('POST /auth/refresh')).toHaveLength(1);
    expect(outcomes.every((outcome) => outcome.status === 'ok')).toBe(true);
  });

  it('allows a fresh request once the previous one has settled', async () => {
    const stub = stubApi({ 'POST /auth/refresh': () => session('tok-1') });
    await refreshSession();
    await refreshSession();
    expect(stub.callsTo('POST /auth/refresh')).toHaveLength(2);
  });

  it('reports signed-out on a 401 and says so to listeners', async () => {
    stubApi({
      'POST /auth/refresh': () => failure(401, 'UNAUTHENTICATED', 'Your session has ended.'),
    });
    const events: SessionEvent[] = [];
    subscribeToSession((event) => events.push(event));

    expect(await refreshSession()).toEqual({ status: 'unauthenticated' });
    expect(events).toEqual([{ type: 'signed-out' }]);
  });

  it('does not sign anyone out when the server cannot be reached', async () => {
    stubApi({
      'POST /auth/refresh': () => {
        throw new TypeError('Failed to fetch');
      },
    });
    const events: SessionEvent[] = [];
    subscribeToSession((event) => events.push(event));

    const outcome = await refreshSession();

    expect(outcome.status).toBe('error');
    expect(events).toEqual([]);
  });

  it('does not sign anyone out on a server error either', async () => {
    stubApi({ 'POST /auth/refresh': () => failure(503, 'SERVICE_UNAVAILABLE', 'Down') });
    const events: SessionEvent[] = [];
    subscribeToSession((event) => events.push(event));

    expect((await refreshSession()).status).toBe('error');
    expect(events).toEqual([]);
  });

  it('takes the cross-tab lock when the browser has one', async () => {
    stubApi({ 'POST /auth/refresh': () => session('tok-1') });
    const request = vi.fn(async (_name: string, task: () => Promise<unknown>) => task());
    Object.defineProperty(navigator, 'locks', { value: { request }, configurable: true });

    await refreshSession();

    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0]?.[0]).toBe('daybook-auth-refresh');
  });
});

describe('API requests with a session', () => {
  it('sends the access token once a session exists', async () => {
    const stub = stubApi({
      'POST /auth/refresh': () => session('tok-1'),
      'GET /things': () => ok([]),
    });
    await refreshSession();

    await api.get('/things');

    expect(stub.callsTo('GET /things')[0]?.headers.Authorization).toBe('Bearer tok-1');
  });

  it('refreshes and replays a request once after a 401', async () => {
    let issued = 0;
    const stub = stubApi({
      'POST /auth/refresh': () => session(`tok-${++issued}`),
      'GET /things': (request) =>
        request.headers.Authorization === 'Bearer tok-2'
          ? ok(['a'])
          : failure(401, 'ACCESS_TOKEN_EXPIRED', 'expired'),
    });
    await refreshSession(); // tok-1, which the server will call expired

    await expect(api.get('/things')).resolves.toEqual(['a']);

    expect(stub.callsTo('GET /things').map((call) => call.headers.Authorization)).toEqual([
      'Bearer tok-1',
      'Bearer tok-2',
    ]);
    expect(stub.callsTo('POST /auth/refresh')).toHaveLength(2);
  });

  it('gives several simultaneous 401s a single refresh', async () => {
    let issued = 0;
    const stub = stubApi({
      'POST /auth/refresh': async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return session(`tok-${++issued}`);
      },
      'GET /a': (request) =>
        request.headers.Authorization ? ok('a') : failure(401, 'UNAUTHENTICATED', 'no token'),
      'GET /b': (request) =>
        request.headers.Authorization ? ok('b') : failure(401, 'UNAUTHENTICATED', 'no token'),
    });

    const results = await Promise.all([api.get('/a'), api.get('/b')]);

    expect(results).toEqual(['a', 'b']);
    expect(stub.callsTo('POST /auth/refresh')).toHaveLength(1);
  });

  it('stops after one replay instead of looping on a persistent 401', async () => {
    const stub = stubApi({
      'POST /auth/refresh': () => session('tok-x'),
      'GET /things': () => failure(401, 'UNAUTHENTICATED', 'nope'),
    });

    await expect(api.get('/things')).rejects.toMatchObject({ status: 401 });

    expect(stub.callsTo('GET /things')).toHaveLength(2);
  });

  it('signs the person out when the refresh itself is refused', async () => {
    stubApi({
      'POST /auth/refresh': () => failure(401, 'UNAUTHENTICATED', 'ended'),
      'GET /things': () => failure(401, 'SESSION_REVOKED', 'revoked'),
    });
    const events: SessionEvent[] = [];
    subscribeToSession((event) => events.push(event));

    const error = await api.get('/things').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401, code: 'SESSION_REVOKED' });
    expect(events).toEqual([{ type: 'signed-out' }]);
  });
});
