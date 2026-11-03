import { format } from 'date-fns';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { navGroups } from '@/app/navigation';
import { IconButton } from '@/components/ui/IconButton';
import { useToday } from '@/hooks/use-today';
import { APP_NAME } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Logo } from './Logo';

interface SidebarContentProps {
  /** Icon-only rail. Labels stay in the DOM for screen readers. */
  collapsed?: boolean;
  showBrand?: boolean;
  /** When provided, a collapse/expand button is shown (desktop only). */
  onToggleCollapsed?: () => void;
  /** Called after a link is followed, so the mobile drawer can close itself. */
  onNavigate?: () => void;
}

/** Shared by the desktop sidebar and the mobile drawer. */
export function SidebarContent({
  collapsed = false,
  showBrand = true,
  onToggleCollapsed,
  onNavigate,
}: SidebarContentProps) {
  const today = useToday();

  return (
    <div className="flex h-full flex-col">
      <div className={cn('pb-4 pt-5', collapsed ? 'px-2' : 'px-4')}>
        {showBrand && (
          <div className={cn('flex items-center gap-2.5', collapsed && 'justify-center')}>
            <Logo />
            {!collapsed && <span className="font-display text-lg font-semibold">{APP_NAME}</span>}
          </div>
        )}
        <time
          dateTime={format(today, 'yyyy-MM-dd')}
          className={cn('block', showBrand && 'mt-5', collapsed && 'text-center')}
        >
          {collapsed ? (
            <span className="font-display text-xl font-semibold">{format(today, 'd')}</span>
          ) : (
            <>
              <span className="block font-display text-3xl font-semibold leading-none">
                {format(today, 'EEEE')}
              </span>
              <span className="mt-1 block text-sm text-fg-muted">
                {format(today, 'd MMMM yyyy')}
              </span>
            </>
          )}
        </time>
      </div>

      <nav aria-label="Primary" className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {navGroups.map((group) => (
          <div key={group.label} className="mt-3 first:mt-0">
            {!collapsed && (
              <p className="px-3 pb-1 text-xs font-medium text-fg-subtle">{group.label}</p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-control py-2 text-sm font-medium text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg aria-[current=page]:bg-accent-soft aria-[current=page]:text-accent-soft-fg',
                      collapsed ? 'justify-center px-0' : 'px-3',
                    )}
                  >
                    <item.icon aria-hidden className="size-[1.125rem] shrink-0" />
                    <span className={cn(collapsed && 'sr-only')}>{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {onToggleCollapsed && (
        <div className={cn('border-t border-border p-2', collapsed ? 'text-center' : 'text-right')}>
          <IconButton
            label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            icon={collapsed ? ChevronsRight : ChevronsLeft}
            onClick={onToggleCollapsed}
          />
        </div>
      )}
    </div>
  );
}
