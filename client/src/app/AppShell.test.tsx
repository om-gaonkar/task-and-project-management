import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderRoutes } from '@/test/render';
import { appRoutes } from './routes';

describe('app shell', () => {
  it('lists every primary destination and marks the current page', () => {
    renderRoutes(appRoutes, ['/projects']);

    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(nav).getAllByRole('link')).toHaveLength(10);
    expect(within(nav).getByRole('link', { name: 'Projects' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Diary' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('heading', { level: 1, name: 'Projects' })).toBeInTheDocument();
  });

  it('shows a not-found page for unknown routes', () => {
    renderRoutes(appRoutes, ['/nowhere']);

    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to overview' })).toHaveAttribute('href', '/');
  });

  it('remembers whether the sidebar is collapsed', async () => {
    const user = userEvent.setup();
    renderRoutes(appRoutes, ['/projects']);

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));

    expect(window.localStorage.getItem('workspace.sidebar-collapsed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
  });

  it('opens the mobile drawer and closes it after choosing a page', async () => {
    const user = userEvent.setup();
    renderRoutes(appRoutes, ['/projects']);
    expect(screen.getAllByRole('navigation', { name: 'Primary' })).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    const navs = screen.getAllByRole('navigation', { name: 'Primary' });
    expect(navs).toHaveLength(2);

    await user.click(within(navs[1]).getByRole('link', { name: 'My Tasks' }));

    expect(screen.getByRole('heading', { level: 1, name: 'My Tasks' })).toBeInTheDocument();
    expect(screen.getAllByRole('navigation', { name: 'Primary' })).toHaveLength(1);
  });

  it('opens the command palette with Ctrl+K and navigates with the keyboard', async () => {
    const user = userEvent.setup();
    renderRoutes(appRoutes, ['/projects']);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

    await user.keyboard('{Control>}k{/Control}');
    const input = screen.getByRole('combobox', { name: 'Search pages and actions' });
    expect(input).toHaveFocus();

    await user.type(input, 'diar');
    expect(screen.getByRole('option', { name: 'Diary' })).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Enter}');

    expect(screen.getByRole('heading', { level: 1, name: 'Diary' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('keeps creation commands disabled until their modules exist', async () => {
    const user = userEvent.setup();
    renderRoutes(appRoutes, ['/projects']);

    await user.keyboard('{Control>}k{/Control}');
    await user.type(screen.getByRole('combobox'), 'new task');
    const option = screen.getByRole('option', { name: /New task/ });
    expect(option).toHaveAttribute('aria-disabled', 'true');

    await user.keyboard('{Enter}');

    expect(screen.getByRole('heading', { level: 1, name: 'Projects' })).toBeInTheDocument();
  });

  it('lists the creation actions in the quick-create menu, all disabled for now', async () => {
    const user = userEvent.setup();
    renderRoutes(appRoutes, ['/projects']);

    await user.click(screen.getByRole('button', { name: 'Create new' }));

    const items = within(screen.getByRole('menu', { name: 'Create new' })).getAllByRole('menuitem');
    expect(items).toHaveLength(8);
    items.forEach((item) => expect(item).toHaveAttribute('aria-disabled', 'true'));
  });

  it('switches theme from the top bar', async () => {
    const user = userEvent.setup();
    renderRoutes(appRoutes, ['/projects']);

    await user.click(screen.getByRole('button', { name: 'Change theme' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Dark' }));

    expect(document.documentElement).toHaveClass('dark');
    expect(window.localStorage.getItem('workspace.theme')).toBe('dark');
  });
});
