import { Menu as MenuIcon, Search } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { ThemeToggle } from '@/features/settings/appearance/ThemeToggle';
import { ProfileMenu } from './ProfileMenu';
import { QuickCreateMenu } from './QuickCreateMenu';

const SHORTCUT =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘K' : 'Ctrl K';

interface TopbarProps {
  onOpenNav: () => void;
  onOpenPalette: () => void;
}

export function Topbar({ onOpenNav, onOpenPalette }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-canvas px-3 sm:px-5">
      <IconButton
        label="Open navigation"
        icon={MenuIcon}
        onClick={onOpenNav}
        className="md:hidden"
      />

      <button
        type="button"
        onClick={onOpenPalette}
        className="hidden h-9 w-full max-w-sm items-center gap-2 rounded-control border border-border-strong bg-surface px-3 text-sm text-fg-muted hover:border-fg-subtle md:flex"
      >
        <Search aria-hidden className="size-4" />
        <span>Search or jump to…</span>
        <kbd className="ml-auto rounded border border-border px-1.5 py-0.5 text-xs text-fg-subtle">
          {SHORTCUT}
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1.5">
        <IconButton label="Search" icon={Search} onClick={onOpenPalette} className="md:hidden" />
        <QuickCreateMenu />
        <ThemeToggle />
        <ProfileMenu />
      </div>
    </header>
  );
}
