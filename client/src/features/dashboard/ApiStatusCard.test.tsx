import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { ApiStatusCard } from './ApiStatusCard';

const healthResponse = (state: string) =>
  new Response(
    JSON.stringify({
      success: true,
      data: {
        status: 'ok',
        uptimeSeconds: 125,
        timestamp: '2026-11-03T10:00:00.000Z',
        database: { state },
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ApiStatusCard', () => {
  it('shows the API and database status from the health endpoint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => healthResponse('connected')),
    );

    renderWithProviders(<ApiStatusCard />);

    expect(await screen.findByText('Online')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('2 minutes')).toBeInTheDocument();
  });

  it('flags a disconnected database', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => healthResponse('disconnected')),
    );

    renderWithProviders(<ApiStatusCard />);

    expect(await screen.findByText('Disconnected')).toBeInTheDocument();
  });

  it('explains a network failure and recovers when retried', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn<() => Promise<Response>>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockImplementation(async () => healthResponse('connected'));
    vi.stubGlobal('fetch', fetchMock);

    renderWithProviders(<ApiStatusCard />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not reach the server');

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Online')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
