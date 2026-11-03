import type { LucideIcon } from 'lucide-react';
import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { navItems } from '@/app/navigation';
import { quickCreateItems } from '@/app/quick-create';
import { Dialog } from '@/components/ui/Dialog';
import { cn } from '@/lib/utils';

interface Command {
  id: string;
  label: string;
  group: 'Go to' | 'Create';
  icon: LucideIcon;
  to?: string;
  disabled?: boolean;
  hint?: string;
}

const COMMANDS: Command[] = [
  ...navItems.map((item): Command => ({
    id: `go-${item.to}`,
    label: item.label,
    group: 'Go to',
    icon: item.icon,
    to: item.to,
  })),
  ...quickCreateItems.map((item): Command => ({
    id: `create-${item.id}`,
    label: `New ${item.label.toLowerCase()}`,
    group: 'Create',
    icon: item.icon,
    disabled: true,
    hint: 'Soon',
  })),
];

function PaletteBody({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const listId = useId();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? COMMANDS.filter((command) => command.label.toLowerCase().includes(needle))
      : COMMANDS;
  }, [query]);

  const current = Math.min(activeIndex, Math.max(results.length - 1, 0));
  const optionId = (index: number) => `${listId}-option-${index}`;

  useEffect(() => {
    document.getElementById(optionId(current))?.scrollIntoView?.({ block: 'nearest' });
    // optionId only depends on listId, which is stable for the lifetime of the component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const run = (command: Command | undefined) => {
    if (!command || command.disabled || !command.to) return;
    onDone();
    void navigate(command.to);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current - 1 + results.length) % results.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      run(results[current]);
    }
  };

  return (
    <div>
      <input
        autoFocus
        role="combobox"
        aria-label="Search pages and actions"
        aria-expanded="true"
        aria-autocomplete="list"
        aria-controls={results.length > 0 ? listId : undefined}
        aria-activedescendant={results.length > 0 ? optionId(current) : undefined}
        autoComplete="off"
        placeholder="Type a page or action…"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
        }}
        onKeyDown={handleKeyDown}
        className="h-12 w-full border-b border-border bg-transparent px-4 text-base text-fg placeholder:text-fg-subtle focus-visible:outline-none"
      />

      {results.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Results"
          className="max-h-80 overflow-y-auto p-2"
        >
          {results.map((command, index) => {
            const showHeading = index === 0 || results[index - 1]?.group !== command.group;
            return (
              <li key={command.id} role="presentation">
                {showHeading && (
                  <p className="px-2.5 pb-1 pt-2 text-xs font-medium text-fg-subtle">
                    {command.group}
                  </p>
                )}
                <div
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === current}
                  aria-disabled={command.disabled || undefined}
                  onMouseMove={() => setActiveIndex(index)}
                  onClick={() => run(command)}
                  className={cn(
                    'flex cursor-pointer items-center gap-2.5 rounded-control px-2.5 py-2 text-sm',
                    index === current && 'bg-surface-muted',
                    command.disabled && 'cursor-not-allowed text-fg-subtle',
                  )}
                >
                  <command.icon aria-hidden className="size-4 shrink-0" />
                  <span className="flex-1">{command.label}</span>
                  {command.hint && <span className="text-xs">{command.hint}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-4 py-8 text-center text-fg-muted">Nothing matches “{query.trim()}”.</p>
      )}

      <p className="border-t border-border px-4 py-2.5 text-xs text-fg-subtle">
        Searching tasks, projects, diary entries and transactions arrives with those modules.
      </p>
    </div>
  );
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Search pages and actions"
      hideTitle
      className="mb-auto mt-[12vh]"
      bodyClassName="p-0"
    >
      <PaletteBody onDone={onClose} />
    </Dialog>
  );
}
