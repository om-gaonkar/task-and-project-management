import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Primary next step, usually a Button or a link styled with buttonStyles(). */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-panel border border-dashed border-border-strong px-6 py-12 text-center',
        className,
      )}
    >
      <span className="mb-4 grid size-11 place-items-center rounded-full bg-accent-soft text-accent-soft-fg">
        <Icon aria-hidden className="size-5" />
      </span>
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {description && <p className="mt-1 max-w-md text-fg-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
