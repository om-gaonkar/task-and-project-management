import { CircleAlert, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface AlertProps {
  tone?: 'danger' | 'info';
  children: ReactNode;
  className?: string;
}

/** Inline message for a form or section. Use ErrorState when a whole panel failed to load. */
export function Alert({ tone = 'danger', children, className }: AlertProps) {
  const Icon = tone === 'danger' ? CircleAlert : Info;
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2.5 rounded-control border px-3 py-2.5 text-sm text-fg',
        tone === 'danger' ? 'border-danger/40 bg-danger-soft' : 'border-border bg-surface-muted',
        className,
      )}
    >
      <Icon
        aria-hidden
        className={cn('mt-0.5 size-4 shrink-0', tone === 'danger' ? 'text-danger' : 'text-accent')}
      />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
