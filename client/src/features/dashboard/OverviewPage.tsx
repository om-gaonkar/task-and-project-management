import { PageHeader } from '@/components/shared/PageHeader';
import { ApiStatusCard } from './ApiStatusCard';

export function OverviewPage() {
  return (
    <>
      <PageHeader
        title="Overview"
        description="Your day at a glance. Task, habit, diary and finance summaries appear here as each module is built."
      />
      <ApiStatusCard />
    </>
  );
}
