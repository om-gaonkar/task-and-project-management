import type { RouteObject } from 'react-router-dom';
import { ComingSoonPage } from '@/components/shared/ComingSoonPage';
import { PublicOnlyRoute, RequireAuth } from '@/features/auth/AuthGates';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { OverviewPage } from '@/features/dashboard/OverviewPage';
import { AppLayout } from './layouts/AppLayout';
import { navItems } from './navigation';
import { NotFoundPage } from './NotFoundPage';
import { RouteError } from './RouteError';

/**
 * Route table, kept separate from the browser router so tests can mount it in a memory router.
 * Sign-in and registration are public (and bounce signed-in people away); every other page sits
 * behind RequireAuth. When a phase delivers a real page, swap its ComingSoonPage element for the
 * feature page.
 */
export const appRoutes: RouteObject[] = [
  {
    element: <PublicOnlyRoute />,
    errorElement: <RouteError />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/register', element: <RegisterPage /> },
        ],
      },
    ],
  },
  {
    path: '/',
    element: <RequireAuth />,
    errorElement: <RouteError />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <OverviewPage /> },
          ...navItems
            .filter((item) => item.to !== '/')
            .map((item): RouteObject => ({
              path: item.to.slice(1),
              element: <ComingSoonPage item={item} />,
            })),
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];
