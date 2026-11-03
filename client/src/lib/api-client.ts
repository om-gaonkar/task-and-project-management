import { API_URL } from './env';

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

export interface ApiEnvelope<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

/** Every failed call surfaces as an ApiError: server errors, malformed responses and network loss. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.details = body.details;
    this.requestId = body.requestId;
  }
}

type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const url = `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const queryString = params.toString();
  return queryString ? `${url}?${queryString}` : url;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function toApiError(status: number, payload: unknown): ApiError {
  if (
    isRecord(payload) &&
    isRecord(payload.error) &&
    typeof payload.error.code === 'string' &&
    typeof payload.error.message === 'string'
  ) {
    return new ApiError(status, {
      code: payload.error.code,
      message: payload.error.message,
      details: payload.error.details,
      requestId: typeof payload.error.requestId === 'string' ? payload.error.requestId : undefined,
    });
  }
  return new ApiError(status, {
    code: `HTTP_${status}`,
    message:
      status >= 500
        ? 'The server had a problem. Try again in a moment.'
        : 'The request could not be completed.',
  });
}

/**
 * The single entry point for talking to the API: base URL, JSON handling, cookies and error
 * normalisation live here. Phase 2 adds the single-flight token refresh at this seam, so feature
 * code never has to change.
 */
export async function apiRequestRaw<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiEnvelope<T>> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  let body: string | undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      body,
      credentials: 'include',
      signal: options.signal,
    });
  } catch (error) {
    // Aborts are intentional (TanStack Query cancels obsolete requests), so they pass through.
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, {
      code: 'NETWORK_ERROR',
      message: 'Could not reach the server. Check your connection and try again.',
    });
  }

  if (response.status === 204) return { success: true, data: undefined as T };

  const payload = await readJson(response);
  if (!response.ok) throw toApiError(response.status, payload);

  if (isRecord(payload) && payload.success === true && 'data' in payload) {
    return payload as unknown as ApiEnvelope<T>;
  }
  throw new ApiError(response.status, {
    code: 'INVALID_RESPONSE',
    message: 'The server sent an unexpected response.',
  });
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return (await apiRequestRaw<T>(path, options)).data;
}

type ReadOptions = Pick<RequestOptions, 'query' | 'signal'>;

export const api = {
  get: <T>(path: string, options?: ReadOptions) =>
    apiRequest<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: ReadOptions) =>
    apiRequest<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: ReadOptions) =>
    apiRequest<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options?: ReadOptions) =>
    apiRequest<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: ReadOptions) =>
    apiRequest<T>(path, { ...options, method: 'DELETE' }),
};
