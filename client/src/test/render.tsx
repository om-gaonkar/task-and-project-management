import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { RouterProvider, createMemoryRouter, type RouteObject } from 'react-router-dom';
import { ThemeProvider } from '@/features/settings/appearance/ThemeProvider';

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
}

export function renderWithProviders(ui: ReactElement) {
  return render(
    <ThemeProvider>
      <QueryClientProvider client={createTestQueryClient()}>{ui}</QueryClientProvider>
    </ThemeProvider>,
  );
}

/** Mounts a route table in a memory router with the same providers the real app uses. */
export function renderRoutes(routes: RouteObject[], initialEntries: string[] = ['/']) {
  const router = createMemoryRouter(routes, { initialEntries });
  render(
    <ThemeProvider>
      <QueryClientProvider client={createTestQueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return router;
}
