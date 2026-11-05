import { format } from 'date-fns';
import type { CSSProperties } from 'react';
import { Outlet } from 'react-router-dom';
import { Logo } from '@/components/layout/Logo';
import { ThemeToggle } from '@/features/settings/appearance/ThemeToggle';
import { useToday } from '@/hooks/use-today';
import { APP_NAME } from '@/lib/constants';

/** One ruled line every 2.25rem, with a margin line like a notebook page. Text below sits on the rules. */
const RULE = '2.25rem';
const ruledPage: CSSProperties = {
  backgroundImage: [
    'linear-gradient(to right, transparent 3.5rem, color-mix(in srgb, var(--accent) 45%, transparent) 3.5rem, color-mix(in srgb, var(--accent) 45%, transparent) calc(3.5rem + 1px), transparent calc(3.5rem + 1px))',
    `repeating-linear-gradient(to bottom, transparent 0, transparent calc(${RULE} - 1px), var(--border) calc(${RULE} - 1px), var(--border) ${RULE})`,
  ].join(', '),
};

/** Shared frame for the sign-in and registration pages. */
export function AuthLayout() {
  const today = useToday();

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div
        className="hidden border-r border-border bg-surface pl-[4.5rem] pr-10 pt-9 lg:block"
        style={ruledPage}
      >
        <div className="flex h-9 items-center gap-2.5">
          <Logo />
          <span className="font-display text-lg font-semibold">{APP_NAME}</span>
        </div>

        <time dateTime={format(today, 'yyyy-MM-dd')} className="mt-36 block">
          <span className="block font-display text-[3.5rem] font-semibold leading-[4.5rem] tracking-tight">
            {format(today, 'EEEE')}
          </span>
          <span className="block text-lg leading-9 text-fg-muted">
            {format(today, 'd MMMM yyyy')}
          </span>
        </time>

        <p className="mt-9 max-w-64 leading-9 text-fg-muted">
          Tasks, notes, habits and money for the day in front of you.
        </p>
      </div>

      <div className="flex min-h-dvh flex-col">
        <div className="flex items-center justify-between px-6 py-4 sm:px-10 lg:justify-end lg:px-16 xl:px-24">
          <div className="flex items-center gap-2.5 lg:hidden">
            <Logo />
            <span className="font-display text-lg font-semibold">{APP_NAME}</span>
          </div>
          <ThemeToggle />
        </div>
        <main
          id="main"
          className="flex flex-1 flex-col justify-center px-6 pb-16 sm:px-10 lg:px-16 xl:px-24"
        >
          <div className="w-full max-w-sm">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
