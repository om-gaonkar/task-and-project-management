import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { IconButton } from './IconButton';
import {
  ToastContext,
  type ToastContextValue,
  type ToastOptions,
  type ToastTone,
} from './toast-context';

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
}

const toneStyles: Record<ToastTone, { icon: typeof Info; className: string }> = {
  success: { icon: CircleCheck, className: 'text-success' },
  error: { icon: CircleAlert, className: 'text-danger' },
  info: { icon: Info, className: 'text-accent' },
};

const MAX_VISIBLE = 4;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, number>());
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    window.clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = nextId.current++;
      const item: ToastItem = {
        id,
        title: options.title,
        description: options.description,
        tone: options.tone ?? 'info',
      };
      setToasts((current) => [...current.slice(-(MAX_VISIBLE - 1)), item]);
      timers.current.set(
        id,
        window.setTimeout(() => dismiss(id), options.durationMs ?? 5000),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const active = timers.current;
    return () => {
      active.forEach((timer) => window.clearTimeout(timer));
      active.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="region"
        aria-label="Notifications"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-3 bottom-3 z-[60] flex flex-col items-end gap-2 sm:left-auto sm:right-4 sm:bottom-4 sm:w-96"
      >
        {toasts.map((item) => {
          const { icon: Icon, className } = toneStyles[item.tone];
          return (
            <div
              key={item.id}
              className="pointer-events-auto flex w-full items-start gap-3 rounded-panel border border-border bg-surface p-3 shadow-popover"
            >
              <Icon aria-hidden className={cn('mt-0.5 size-5 shrink-0', className)} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-fg">{item.title}</p>
                {item.description && <p className="text-fg-muted">{item.description}</p>}
              </div>
              <IconButton label="Dismiss" icon={X} size="sm" onClick={() => dismiss(item.id)} />
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
