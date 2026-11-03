import { useCallback, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { SidebarContent } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { Drawer } from '@/components/ui/Drawer';
import { usePersistentState } from '@/hooks/use-persistent-state';
import { APP_NAME } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function AppLayout() {
  // First visit: tablets start with the icon rail, desktops with the full sidebar.
  const [collapsed, setCollapsed] = usePersistentState(
    'workspace.sidebar-collapsed',
    () => window.matchMedia('(max-width: 1023px)').matches,
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-control focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:shadow-popover"
      >
        Skip to content
      </a>

      <aside
        className={cn(
          'sticky top-0 hidden h-dvh shrink-0 border-r border-border bg-surface transition-[width] duration-200 md:block',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        <SidebarContent collapsed={collapsed} onToggleCollapsed={() => setCollapsed(!collapsed)} />
      </aside>

      <Drawer open={mobileNavOpen} onClose={closeMobileNav} title={APP_NAME} side="left">
        <SidebarContent showBrand={false} onNavigate={closeMobileNav} />
      </Drawer>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onOpenNav={() => setMobileNavOpen(true)}
          onOpenPalette={() => setPaletteOpen(true)}
        />
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 focus:outline-none sm:px-6 lg:px-8"
        >
          <Outlet />
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={closePalette} />
    </div>
  );
}
