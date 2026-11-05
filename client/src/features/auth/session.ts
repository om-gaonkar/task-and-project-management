import { ApiError, apiRequestRaw, setAuthHooks } from '@/lib/api-client';
import type { AuthUser, SessionPayload } from './types';

/**
 * The access token lives only in this module's memory: never in localStorage or a cookie that
 * scripts can read, so a cross-site-scripting bug cannot read it back out of storage. A page
 * reload loses it on purpose; the httpOnly refresh cookie then brings it back (see refreshSession).
 */
let accessToken: string | null = null;

export type SessionEvent = { type: 'signed-in'; user: AuthUser } | { type: 'signed-out' };

const listeners = new Set<(event: SessionEvent) => void>();

export function subscribeToSession(listener: (event: SessionEvent) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(event: SessionEvent): void {
  listeners.forEach((listener) => listener(event));
}

export function startSession(payload: SessionPayload): void {
  accessToken = payload.accessToken;
  emit({ type: 'signed-in', user: payload.user });
}

export function endSession(): void {
  accessToken = null;
  emit({ type: 'signed-out' });
}

export type RefreshOutcome =
  | { status: 'ok'; payload: SessionPayload }
  /** No valid refresh cookie: the person is signed out. */
  | { status: 'unauthenticated' }
  /** The server could not be asked (offline, 5xx). Says nothing about whether they are signed in. */
  | { status: 'error'; error: ApiError };

const LOCK_NAME = 'daybook-auth-refresh';

/**
 * Refresh tokens are single-use, so two refreshes with the same cookie look like theft to the
 * server and end the session. Within a tab, concurrent callers share one request. Across tabs the
 * Web Locks API makes them take turns: the second tab then sends the cookie the first one just
 * received. Browsers without it fall back to the per-tab behaviour.
 */
async function exclusively<T>(task: () => Promise<T>): Promise<T> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  return locks ? locks.request(LOCK_NAME, task) : task();
}

async function requestRefresh(): Promise<RefreshOutcome> {
  try {
    const { data } = await apiRequestRaw<SessionPayload>('/auth/refresh', {
      method: 'POST',
      skipAuth: true,
    });
    startSession(data);
    return { status: 'ok', payload: data };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (error.status === 401) {
      endSession();
      return { status: 'unauthenticated' };
    }
    return { status: 'error', error };
  }
}

let inFlight: Promise<RefreshOutcome> | null = null;

export function refreshSession(): Promise<RefreshOutcome> {
  inFlight ??= exclusively(requestRefresh).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

// Plug the session into the API client: it attaches the token and refreshes on a 401.
setAuthHooks({
  getAccessToken: () => accessToken,
  refresh: async () => {
    const outcome = await refreshSession();
    return outcome.status === 'ok' ? outcome.payload.accessToken : null;
  },
});
