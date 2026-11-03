import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';
import { Menu } from './Menu';

function Example({ onSelect }: { onSelect: () => void }) {
  return (
    <Menu
      label="Create"
      items={[
        { id: 'a', label: 'Alpha', onSelect },
        { id: 'b', label: 'Beta', disabled: true, onSelect },
        { id: 'c', label: 'Gamma', onSelect },
      ]}
      renderTrigger={(props) => <Button {...props}>Open</Button>}
    />
  );
}

describe('Menu', () => {
  it('opens on click and focuses the first item', async () => {
    const user = userEvent.setup();
    render(<Example onSelect={vi.fn()} />);

    const trigger = screen.getByRole('button', { name: 'Open' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu', { name: 'Create' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Alpha' })).toHaveFocus();
  });

  it('moves focus with the arrow keys and wraps around', async () => {
    const user = userEvent.setup();
    render(<Example onSelect={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Open' }));

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Beta' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Gamma' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Alpha' })).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'Gamma' })).toHaveFocus();
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<Example onSelect={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    await user.click(trigger);

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('runs onSelect for enabled items and closes', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<Example onSelect={onSelect} />);
    await user.click(screen.getByRole('button', { name: 'Open' }));

    await user.click(screen.getByRole('menuitem', { name: 'Gamma' }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('ignores disabled items and stays open', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<Example onSelect={onSelect} />);
    await user.click(screen.getByRole('button', { name: 'Open' }));

    await user.click(screen.getByRole('menuitem', { name: 'Beta' }));

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('closes when clicking outside', async () => {
    const user = userEvent.setup();
    render(<Example onSelect={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Open' }));

    await user.click(document.body);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
