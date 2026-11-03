import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useModalDialog } from './use-modal-dialog';

const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' } as const;

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** Keeps the title for screen readers but hides it visually. */
  hideTitle?: boolean;
  size?: keyof typeof sizes;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children?: ReactNode;
}

/** Centered modal. Content mounts only while open, so form state resets on every open. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  hideTitle = false,
  size = 'md',
  footer,
  className,
  bodyClassName,
  children,
}: DialogProps) {
  const { ref, onBackdropClick } = useModalDialog(open, onClose);
  const titleId = useId();
  const descriptionId = useId();

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClick={onBackdropClick}
      className={cn(
        'm-auto w-[calc(100%-1.5rem)] rounded-panel border border-border bg-surface p-0 text-fg shadow-popover',
        sizes[size],
        className,
      )}
    >
      {open && (
        <div className="flex max-h-[85dvh] flex-col">
          <div className={cn('px-5 pt-5', hideTitle && 'sr-only')}>
            <h2 id={titleId} className="font-display text-lg font-semibold">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-fg-muted">
                {description}
              </p>
            )}
          </div>
          {children && (
            <div className={cn('min-h-0 flex-1 overflow-y-auto px-5 py-4', bodyClassName)}>
              {children}
            </div>
          )}
          {footer && (
            <div className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>
          )}
        </div>
      )}
    </dialog>
  );
}
