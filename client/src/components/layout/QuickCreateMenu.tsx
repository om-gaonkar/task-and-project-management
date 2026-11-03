import { Plus } from 'lucide-react';
import { quickCreateItems } from '@/app/quick-create';
import { Button } from '@/components/ui/Button';
import { Menu, type MenuItem } from '@/components/ui/Menu';

const items: MenuItem[] = quickCreateItems.map((item) => ({
  id: item.id,
  label: item.label,
  icon: item.icon,
  hint: 'Soon',
  disabled: true,
}));

export function QuickCreateMenu() {
  return (
    <Menu
      label="Create new"
      items={items}
      align="end"
      renderTrigger={(props) => (
        <Button variant="primary" aria-label="Create new" {...props}>
          <Plus aria-hidden className="size-4" />
          <span className="hidden sm:inline">New</span>
        </Button>
      )}
    />
  );
}
