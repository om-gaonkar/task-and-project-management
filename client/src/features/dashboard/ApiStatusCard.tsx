import { useQuery } from '@tanstack/react-query';
import { formatDistanceStrict } from 'date-fns';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { getHealth, systemKeys, type DatabaseState } from './api';

function describeDatabase(state: DatabaseState) {
  if (state === 'connected') return { label: 'Connected', tone: 'success' as const };
  if (state === 'connecting') return { label: 'Connecting', tone: 'warning' as const };
  return { label: state.charAt(0).toUpperCase() + state.slice(1), tone: 'danger' as const };
}

/** Real data from GET /health. It also exercises the API client, the query layer and the error states. */
export function ApiStatusCard() {
  const health = useQuery({
    queryKey: systemKeys.health(),
    queryFn: ({ signal }) => getHealth(signal),
    staleTime: 15_000,
  });

  return (
    <section
      aria-labelledby="connection-heading"
      aria-busy={health.isPending}
      className="rounded-panel border border-border bg-surface"
    >
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <h2 id="connection-heading" className="font-display text-lg font-semibold">
            Workspace connection
          </h2>
          <p className="mt-0.5 text-fg-muted">
            Whether this app can reach the API and its database.
          </p>
        </div>
        {health.isSuccess && (
          <Button size="sm" onClick={() => void health.refetch()} loading={health.isFetching}>
            Check again
          </Button>
        )}
      </div>

      <div className="px-5 py-4">
        {health.isPending && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        )}

        {health.isError && (
          <ErrorState
            title="Can’t reach the API"
            message={health.error.message}
            onRetry={() => void health.refetch()}
            retrying={health.isFetching}
          />
        )}

        {health.isSuccess && (
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-fg-muted">API</dt>
              <dd className="mt-1">
                <Badge tone="success">Online</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-fg-muted">Database</dt>
              <dd className="mt-1">
                <Badge tone={describeDatabase(health.data.database.state).tone}>
                  {describeDatabase(health.data.database.state).label}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-fg-muted">Server uptime</dt>
              <dd className="mt-1 font-medium">
                {formatDistanceStrict(0, health.data.uptimeSeconds * 1000)}
              </dd>
            </div>
          </dl>
        )}
      </div>
    </section>
  );
}
