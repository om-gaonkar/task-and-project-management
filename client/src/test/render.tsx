import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { RouterProvider, createMemoryRouter, type RouteObject } from 'react-router-dom';
import { AuthContext, type AuthContextValue } from '@/features/auth/auth-context';
import { AuthProvider } from '@/features/auth/AuthProvider';
import type { AuthUser } from '@/features/auth/types';
import { ThemeProvider } from '@/features/settings/appearance/ThemeProvider';

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
}

export const testUser: AuthUser = {
  id: 'user-1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  avatarUrl: null,
  providers: ['password'],
  createdAt: '2026-01-01T00:00:00.000Z',
};

export function renderWithProviders(ui: ReactElement) {
  return render(
    <ThemeProvider>
      <QueryClientProvider client={createTestQueryClient()}>{ui}</QueryClientProvider>
    </ThemeProvider>,
  );
}

interface RenderRoutesOptions {
  /**
   * 'signed-in' (default) and 'signed-out' use a fixed fake, so shell tests do not depend on the
   * network. 'real' mounts the actual AuthProvider; the test then has to stub fetch.
   */
  auth?: 'signed-in' | 'signed-out' | 'real';
}

function fakeAuth(signedIn: boolean): AuthContextValue {
  return {
    status: signedIn ? 'authenticated' : 'unauthenticated',
    user: signedIn ? testUser : null,
    signIn: async () => undefined,
    signUp: async () => undefined,
    signOut: async () => undefined,
    retry: () => undefined,
  };
}

function withAuth(mode: NonNullable<RenderRoutesOptions['auth']>, children: ReactNode) {
  if (mode === 'real') return <AuthProvider>{children}</AuthProvider>;
  return (
    <AuthContext.Provider value={fakeAuth(mode === 'signed-in')}>{children}</AuthContext.Provider>
  );
}

/** Mounts a route table in a memory router with the same providers the real app uses. */
export function renderRoutes(
  routes: RouteObject[],
  initialEntries: string[] = ['/'],
  { auth = 'signed-in' }: RenderRoutesOptions = {},
) {
  const router = createMemoryRouter(routes, { initialEntries });
  render(
    <ThemeProvider>
      <QueryClientProvider client={createTestQueryClient()}>
        {withAuth(auth, <RouterProvider router={router} />)}
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return router;
}
