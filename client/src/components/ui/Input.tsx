import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends ComponentProps<'input'> {
  invalid?: boolean;
}

export function Input({ invalid, className, ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        'h-9 w-full rounded-control border border-border-strong bg-surface px-3 text-sm text-fg placeholder:text-fg-subtle disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger',
        className,
      )}
      {...props}
    />
  );
}
