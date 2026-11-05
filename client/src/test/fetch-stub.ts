import { vi } from 'vitest';

export interface RecordedRequest {
  method: string;
  /** Path below the API base URL, for example "/auth/login". */
  path: string;
  headers: Record<string, string>;
  body: unknown;
  credentials?: RequestCredentials;
}

type Handler = (request: RecordedRequest) => Response | Promise<Response>;

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const ok = (data: unknown, status = 200) => json({ success: true, data }, status);

export const failure = (status: number, code: string, message: string, details?: unknown) =>
  json({ success: false, error: { code, message, ...(details ? { details } : {}) } }, status);

export const noContent = () => new Response(null, { status: 204 });

/**
 * Routes are keyed "METHOD /path", for example "POST /auth/login". A handler may return a
 * Response, or throw to simulate a network failure. Requests nobody stubbed get a 404 and are
 * listed in `unstubbed`, so a test can assert it never reached an unexpected endpoint.
 */
export function stubApi(routes: Record<string, Handler>) {
  const calls: RecordedRequest[] = [];
  const unstubbed: string[] = [];

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const request: RecordedRequest = {
      method: (init?.method ?? 'GET').toUpperCase(),
      path: url.pathname.replace(/^\/api\/v1/, ''),
      headers: { ...(init?.headers as Record<string, string> | undefined) },
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      credentials: init?.credentials,
    };
    calls.push(request);

    const handler = routes[`${request.method} ${request.path}`];
    if (!handler) {
      unstubbed.push(`${request.method} ${request.path}`);
      return failure(404, 'NOT_STUBBED', 'No stub for this request');
    }
    return handler(request);
  });

  vi.stubGlobal('fetch', fetchMock);
  const callsTo = (key: string) => calls.filter((call) => `${call.method} ${call.path}` === key);
  return { calls, callsTo, unstubbed, fetchMock };
}
