import {
  CalendarPlus,
  FolderKanban,
  ListChecks,
  ListTree,
  Repeat,
  BookOpen,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';

export interface QuickCreateItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

/**
 * The creation actions the spec asks for. They are listed now so the menu and palette are
 * complete, and they stay disabled until the module behind each one exists.
 */
export const quickCreateItems: QuickCreateItem[] = [
  { id: 'task', label: 'Task', icon: ListChecks },
  { id: 'project', label: 'Project', icon: FolderKanban },
  { id: 'subtask', label: 'Subtask', icon: ListTree },
  { id: 'diary-entry', label: 'Diary entry', icon: BookOpen },
  { id: 'habit', label: 'Habit', icon: Repeat },
  { id: 'calendar-event', label: 'Calendar event', icon: CalendarPlus },
  { id: 'income', label: 'Income transaction', icon: TrendingUp },
  { id: 'expense', label: 'Expense transaction', icon: TrendingDown },
];
