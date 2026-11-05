import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as authApi from './api';
import { AuthContext, type AuthContextValue, type AuthStatus } from './auth-context';
import { endSession, refreshSession, startSession, subscribeToSession } from './session';
import type { AuthUser } from './types';

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(
    () =>
      subscribeToSession((event) => {
        if (event.type === 'signed-in') {
          setState({ status: 'authenticated', user: event.user });
        } else {
          // Cached data belongs to the person who just left, so none of it may survive.
          queryClient.clear();
          setState({ status: 'unauthenticated', user: null });
        }
      }),
    [queryClient],
  );

  // On every page load the access token is gone, so ask the refresh cookie for a new one.
  useEffect(() => {
    let cancelled = false;
    setState((current) =>
      current.status === 'error' ? { status: 'loading', user: null } : current,
    );
    void refreshSession()
      .then((outcome) => {
        if (!cancelled && outcome.status === 'error') setState({ status: 'error', user: null });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', user: null });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const signIn = useCallback<AuthContextValue['signIn']>(
    async (credentials) => {
      const { user, accessToken, expiresIn } = await authApi.login(credentials);
      queryClient.clear();
      startSession({ user, accessToken, expiresIn });
    },
    [queryClient],
  );

  const signUp = useCallback<AuthContextValue['signUp']>(
    async (registration) => {
      const { user, accessToken, expiresIn } = await authApi.register(registration);
      queryClient.clear();
      startSession({ user, accessToken, expiresIn });
    },
    [queryClient],
  );

  const signOut = useCallback<AuthContextValue['signOut']>(async () => {
    try {
      await authApi.logout();
    } catch {
      // Even if the server cannot be reached, this browser must stop acting as signed in.
    }
    endSession();
  }, []);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, signIn, signUp, signOut, retry }),
    [state, signIn, signUp, signOut, retry],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
