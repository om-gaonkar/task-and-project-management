import { Check, type LucideIcon } from 'lucide-react';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { cn } from '@/lib/utils';

export interface MenuItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  /** Short trailing text, for example "Soon". */
  hint?: string;
  /** Stays focusable (so screen readers announce it) but cannot be activated. */
  disabled?: boolean;
  /** When defined the item is a radio option and shows a check mark if true. */
  checked?: boolean;
  onSelect?: () => void;
}

export interface MenuTriggerProps {
  ref: RefObject<HTMLButtonElement | null>;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  'aria-haspopup': 'menu';
  'aria-expanded': boolean;
  'aria-controls': string | undefined;
}

interface MenuProps {
  /** Accessible name of the menu itself. */
  label: string;
  items: MenuItem[];
  align?: 'start' | 'end';
  /** Spread the given props onto a Button or IconButton. */
  renderTrigger: (props: MenuTriggerProps) => ReactNode;
}

const ITEM_SELECTOR = '[role^="menuitem"]';

/** Dropdown menu following the ARIA menu button pattern: arrows, Home/End, Escape, Tab. */
export function Menu({ label, items, align = 'start', renderTrigger }: MenuProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const panel = panelRef.current;
    const initial =
      panel?.querySelector<HTMLElement>('[aria-checked="true"]') ??
      panel?.querySelector<HTMLElement>(ITEM_SELECTOR);
    initial?.focus();

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  const closeAndRefocus = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handlePanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const nodes: HTMLElement[] = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? [],
    );
    if (nodes.length === 0) return;
    const index = nodes.indexOf(document.activeElement as HTMLElement);

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        nodes[(index + 1) % nodes.length]?.focus();
        break;
      case 'ArrowUp':
        event.preventDefault();
        nodes[(index - 1 + nodes.length) % nodes.length]?.focus();
        break;
      case 'Home':
        event.preventDefault();
        nodes[0]?.focus();
        break;
      case 'End':
        event.preventDefault();
        nodes[nodes.length - 1]?.focus();
        break;
      case 'Escape':
        event.preventDefault();
        closeAndRefocus();
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  const handleSelect = (item: MenuItem) => {
    if (item.disabled) return;
    closeAndRefocus();
    item.onSelect?.();
  };

  const triggerProps: MenuTriggerProps = {
    ref: triggerRef,
    onClick: () => setOpen((current) => !current),
    onKeyDown: (event) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setOpen(true);
      }
    },
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': open ? panelId : undefined,
  };

  return (
    <div className="relative inline-flex">
      {renderTrigger(triggerProps)}
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="menu"
          aria-label={label}
          onKeyDown={handlePanelKeyDown}
          className={cn(
            'absolute top-full z-50 mt-1.5 min-w-56 max-w-[calc(100vw-1.5rem)] rounded-panel border border-border bg-surface p-1 shadow-popover',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
                aria-checked={item.checked}
                aria-disabled={item.disabled || undefined}
                tabIndex={-1}
                onClick={() => handleSelect(item)}
                className="flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-left text-sm text-fg hover:bg-surface-muted focus:bg-surface-muted focus-visible:-outline-offset-2 aria-disabled:cursor-not-allowed aria-disabled:text-fg-subtle aria-disabled:hover:bg-transparent"
              >
                {Icon && <Icon aria-hidden className="size-4 shrink-0" />}
                <span className="flex-1">{item.label}</span>
                {item.hint && <span className="text-xs text-fg-subtle">{item.hint}</span>}
                {item.checked && <Check aria-hidden className="size-4 shrink-0 text-accent" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
