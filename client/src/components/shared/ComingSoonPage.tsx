import type { NavItem } from '@/app/navigation';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from './PageHeader';

/** Stand-in for modules that a later phase builds. Replace the route's element when it ships. */
export function ComingSoonPage({ item }: { item: NavItem }) {
  return (
    <>
      <PageHeader title={item.label} description={item.description} />
      <EmptyState
        icon={item.icon}
        title="Not built yet"
        description={`This page arrives in phase ${item.phase ?? '?'} of the build.`}
      />
    </>
  );
}
