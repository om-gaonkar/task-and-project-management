import { cn } from '@/lib/utils';

/** Notebook-page mark: three ruled lines on the accent colour. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={cn('size-8 shrink-0', className)}>
      <rect width="24" height="24" rx="7" fill="var(--accent)" />
      <path
        d="M7 8h10M7 12h10M7 16h6"
        stroke="var(--accent-fg)"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
