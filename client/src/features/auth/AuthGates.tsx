import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ErrorState } from '@/components/ui/ErrorState';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from './auth-context';
import { safeReturnPath } from './return-path';

function CheckingSession() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div role="status" className="flex items-center gap-3 text-fg-muted">
        <Spinner label="Checking your session" />
        <span>Checking your session…</span>
      </div>
    </div>
  );
}

/** Everything inside needs a signed-in person. Others are sent to /login and returned afterwards. */
export function RequireAuth() {
  const { status, retry } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <CheckingSession />;

  if (status === 'error') {
    return (
      <div className="mx-auto grid min-h-dvh max-w-xl place-items-center p-6">
        <ErrorState
          title="Can’t check your sign-in"
          message="Daybook could not reach the server. Check your connection and try again."
          onRetry={retry}
        />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    const from = `${location.pathname}${location.search}`;
    return <Navigate to="/login" replace state={{ from }} />;
  }

  return <Outlet />;
}

/** Sign-in and registration pages. Someone who is already signed in has no use for them. */
export function PublicOnlyRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <CheckingSession />;

  if (status === 'authenticated') {
    const from = (location.state as { from?: unknown } | null)?.from;
    return <Navigate to={safeReturnPath(from)} replace />;
  }

  // "error" falls through: the login form is still usable and will report its own failures.
  return <Outlet />;
}
