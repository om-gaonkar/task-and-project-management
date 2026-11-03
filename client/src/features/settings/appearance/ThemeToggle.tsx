import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { Menu, type MenuItem } from '@/components/ui/Menu';
import { useTheme, type ThemeMode } from './theme-context';

const options: { mode: ThemeMode; label: string; icon: LucideIcon }[] = [
  { mode: 'light', label: 'Light', icon: Sun },
  { mode: 'dark', label: 'Dark', icon: Moon },
  { mode: 'system', label: 'System', icon: Monitor },
];

/** Compact theme picker for the top bar. Phase 3 adds the same choice to the profile menu and Settings. */
export function ThemeToggle() {
  const { mode, resolved, setMode } = useTheme();

  const items: MenuItem[] = options.map((option) => ({
    id: option.mode,
    label: option.label,
    icon: option.icon,
    checked: mode === option.mode,
    onSelect: () => setMode(option.mode),
  }));

  return (
    <Menu
      label="Theme"
      items={items}
      align="end"
      renderTrigger={(props) => (
        <IconButton
          label="Change theme"
          icon={mode === 'system' ? Monitor : resolved === 'dark' ? Moon : Sun}
          {...props}
        />
      )}
    />
  );
}
