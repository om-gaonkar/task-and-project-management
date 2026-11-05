import { createContext, useContext } from 'react';
import type { AuthUser, Credentials, Registration } from './types';

/**
 * loading: the first refresh is still in flight, so we cannot yet say who is signed in.
 * error: the server could not be reached, which is different from being signed out.
 */
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  signIn: (credentials: Credentials) => Promise<void>;
  signUp: (registration: Registration) => Promise<void>;
  signOut: () => Promise<void>;
  /** Tries the first refresh again after status "error". */
  retry: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}

/** Same as useAuth, for components that only render behind the sign-in gate. */
export function useCurrentUser(): AuthUser {
  const { user } = useAuth();
  if (!user) throw new Error('useCurrentUser was used while signed out');
  return user;
}
