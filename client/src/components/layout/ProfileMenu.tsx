import { LogOut, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '@/components/ui/Avatar';
import { Menu, type MenuItem } from '@/components/ui/Menu';
import { useAuth } from '@/features/auth/auth-context';

export function ProfileMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const items: MenuItem[] = [
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      onSelect: () => void navigate('/settings'),
    },
    { id: 'sign-out', label: 'Sign out', icon: LogOut, onSelect: () => void signOut() },
  ];

  return (
    <Menu
      label="Account"
      items={items}
      align="end"
      header={
        <>
          <p className="truncate text-sm font-medium text-fg">{user.name}</p>
          <p className="truncate text-xs text-fg-muted">{user.email}</p>
        </>
      }
      renderTrigger={(props) => (
        <button
          type="button"
          aria-label={`Account menu for ${user.name}`}
          title={user.email}
          className="rounded-full"
          {...props}
        >
          <Avatar name={user.name} imageUrl={user.avatarUrl} />
        </button>
      )}
    />
  );
}
