import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Spinner({ label = 'Loading', className }: { label?: string; className?: string }) {
  return (
    <span role="status" aria-label={label} className="inline-flex">
      <LoaderCircle aria-hidden className={cn('size-5 animate-spin text-fg-muted', className)} />
    </span>
  );
}
