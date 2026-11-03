import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api-client';

/** One QueryClient for the whole app (created once in AppProviders). */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        // Retrying a 4xx never helps. Network failures and 5xx get two more attempts.
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
          failureCount < 2,
      },
      mutations: { retry: false },
    },
  });
}
