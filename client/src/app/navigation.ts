import {
  Activity,
  BookOpen,
  CalendarDays,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  Repeat,
  Settings,
  Tags,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  description: string;
  /** Build phase that delivers the real page. Omitted for pages that already exist. */
  phase?: number;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Single source of truth for the sidebar, the mobile drawer, the command palette and the routes. */
export const navGroups: NavGroup[] = [
  {
    label: 'Plan',
    items: [
      {
        to: '/',
        label: 'Overview',
        icon: LayoutDashboard,
        description: 'Your day at a glance.',
      },
      {
        to: '/tasks',
        label: 'My Tasks',
        icon: ListChecks,
        description: 'Every task in list, board, calendar and timeline views.',
        phase: 4,
      },
      {
        to: '/projects',
        label: 'Projects',
        icon: FolderKanban,
        description: 'Group tasks, notes, files and deadlines by project.',
        phase: 4,
      },
      {
        to: '/calendar',
        label: 'Calendar',
        icon: CalendarDays,
        description: 'Tasks, deadlines, habits, events and diary entries on one calendar.',
        phase: 8,
      },
    ],
  },
  {
    label: 'Record',
    items: [
      {
        to: '/diary',
        label: 'Diary',
        icon: BookOpen,
        description: 'A private journal linked to your tasks and projects.',
        phase: 7,
      },
      {
        to: '/habits',
        label: 'Habits',
        icon: Repeat,
        description: 'Daily and weekly habits with streaks and history.',
        phase: 8,
      },
      {
        to: '/finance',
        label: 'Finance',
        icon: Wallet,
        description: 'Income, expenses and budgets.',
        phase: 9,
      },
    ],
  },
  {
    label: 'Review',
    items: [
      {
        to: '/analytics',
        label: 'Analytics',
        icon: Activity,
        description: 'Trends across tasks, habits, writing and spending.',
        phase: 9,
      },
    ],
  },
  {
    label: 'Organize',
    items: [
      {
        to: '/tags',
        label: 'Tags',
        icon: Tags,
        description: 'Labels shared by tasks, projects and diary entries.',
        phase: 4,
      },
      {
        to: '/settings',
        label: 'Settings',
        icon: Settings,
        description: 'Appearance, account and security.',
        phase: 3,
      },
    ],
  },
];

export const navItems: NavItem[] = navGroups.flatMap((group) => group.items);
