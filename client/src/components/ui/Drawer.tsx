import { X } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { IconButton } from './IconButton';
import { useModalDialog } from './use-modal-dialog';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  side?: 'left' | 'right';
  className?: string;
  children: ReactNode;
}

/** Full-height side sheet. Used for the mobile navigation now and detail panels later. */
export function Drawer({ open, onClose, title, side = 'left', className, children }: DrawerProps) {
  const { ref, onBackdropClick } = useModalDialog(open, onClose);
  const titleId = useId();

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClick={onBackdropClick}
      className={cn(
        'm-0 h-dvh max-h-none w-[min(20rem,88vw)] max-w-none rounded-none border-border bg-surface p-0 text-fg shadow-popover',
        side === 'left' ? 'mr-auto border-r' : 'ml-auto border-l',
        className,
      )}
    >
      {open && (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-border py-2 pl-4 pr-2">
            <h2 id={titleId} className="font-display text-lg font-semibold">
              {title}
            </h2>
            <IconButton label="Close" icon={X} onClick={onClose} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </div>
      )}
    </dialog>
  );
}
