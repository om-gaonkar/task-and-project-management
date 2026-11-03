import { TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  /** Say what happened and, where possible, what to do about it. */
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  retrying = false,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-start gap-3 rounded-panel border border-danger/40 bg-danger-soft p-4 sm:flex-row sm:items-center',
        className,
      )}
    >
      <TriangleAlert aria-hidden className="size-5 shrink-0 text-danger" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-fg">{title}</p>
        <p className="text-fg-muted">{message}</p>
      </div>
      {onRetry && (
        <Button size="sm" onClick={onRetry} loading={retrying}>
          Try again
        </Button>
      )}
    </div>
  );
}
