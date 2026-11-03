import { cn } from '@/lib/utils';

/** Decorative placeholder. Give the surrounding region aria-busy / a status label instead. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('animate-pulse rounded-control bg-surface-muted', className)} />
  );
}
