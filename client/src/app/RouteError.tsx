import { useRouteError } from 'react-router-dom';
import { ErrorState } from '@/components/ui/ErrorState';

/** Last-resort boundary for errors thrown while rendering a route. */
export function RouteError() {
  const error = useRouteError();
  console.error(error);

  return (
    <div className="mx-auto max-w-xl p-6">
      <ErrorState
        title="This page failed to load"
        message="An unexpected error stopped the page from rendering. Reloading usually fixes it."
        onRetry={() => window.location.reload()}
      />
    </div>
  );
}
