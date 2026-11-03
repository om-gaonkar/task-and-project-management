import { Compass } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/shared/PageHeader';
import { buttonStyles } from '@/components/ui/button-styles';
import { EmptyState } from '@/components/ui/EmptyState';

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" />
      <EmptyState
        icon={Compass}
        title="This page doesn’t exist"
        description="The link may be out of date, or the address was typed incorrectly."
        action={
          <Link to="/" className={buttonStyles({ variant: 'primary' })}>
            Go to overview
          </Link>
        }
      />
    </>
  );
}
