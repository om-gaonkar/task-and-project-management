import type { RouteObject } from 'react-router-dom';
import { ComingSoonPage } from '@/components/shared/ComingSoonPage';
import { OverviewPage } from '@/features/dashboard/OverviewPage';
import { AppLayout } from './layouts/AppLayout';
import { navItems } from './navigation';
import { NotFoundPage } from './NotFoundPage';
import { RouteError } from './RouteError';

/**
 * Route table, kept separate from the browser router so tests can mount it in a memory router.
 * When a phase delivers a real page, swap its ComingSoonPage element for the feature page.
 */
export const appRoutes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <RouteError />,
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
];
