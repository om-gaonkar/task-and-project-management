import { api } from '@/lib/api-client';
import type { Credentials, Registration, SessionPayload } from './types';

export const authKeys = {
  all: ['auth'] as const,
  providers: () => [...authKeys.all, 'providers'] as const,
};

export interface AuthProviders {
  google: boolean;
}

export const login = (credentials: Credentials) =>
  api.post<SessionPayload>('/auth/login', credentials, { skipAuth: true });

export const register = (registration: Registration) =>
  api.post<SessionPayload>('/auth/register', registration, { skipAuth: true });

/** Revokes the session on the server and clears the cookie. Safe to call when already signed out. */
export const logout = () => api.post<void>('/auth/logout', undefined, { skipAuth: true });

export const getProviders = (signal?: AbortSignal) =>
  api.get<AuthProviders>('/auth/providers', { signal, skipAuth: true });
