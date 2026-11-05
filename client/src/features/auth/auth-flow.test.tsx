import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { appRoutes } from '@/app/routes';
import { failure, noContent, ok, stubApi } from '@/test/fetch-stub';
import { renderRoutes, testUser } from '@/test/render';
import { endSession } from './session';

const session = (accessToken = 'tok-1') => ok({ user: testUser, accessToken, expiresIn: 900 });
const signedOut = () => failure(401, 'UNAUTHENTICATED', 'Your session has ended. Sign in again.');
const noGoogle = () => ok({ google: false });
const health = () =>
  ok({
    status: 'ok',
    uptimeSeconds: 60,
    timestamp: '2026-11-04T10:00:00.000Z',
    database: { state: 'connected' },
  });

afterEach(() => {
  endSession();
});

async function signInWith(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  return user;
}

describe('signed-out visitors', () => {
  it('are sent to the sign-in page and returned to where they were going afterwards', async () => {
    const stub = stubApi({
      'POST /auth/refresh': signedOut,
      'GET /auth/providers': noGoogle,
      'POST /auth/login': () => session(),
    });
    const router = renderRoutes(appRoutes, ['/projects?tab=open'], { auth: 'real' });

    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');

    await signInWith('ada@example.com', 'correct horse battery');

    expect(await screen.findByRole('heading', { level: 1, name: 'Projects' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/projects');
    expect(router.state.location.search).toBe('?tab=open');

    const [login] = stub.callsTo('POST /auth/login');
    expect(login?.body).toEqual({ email: 'ada@example.com', password: 'correct horse battery' });
    expect(login?.headers['X-CSRF-Token']).toBe('1');
    expect(login?.headers.Authorization).toBeUndefined();
    expect(login?.credentials).toBe('include');
    expect(stub.unstubbed).toEqual([]);
  });

  it('trims the email before sending it', async () => {
    const stub = stubApi({
      'POST /auth/refresh': signedOut,
      'GET /auth/providers': noGoogle,
      'POST /auth/login': () => session(),
    });
    renderRoutes(appRoutes, ['/login'], { auth: 'real' });

    await signInWith('  ada@example.com  ', 'pw');

    await waitFor(() => expect(stub.callsTo('POST /auth/login')).toHaveLength(1));
    expect(stub.callsTo('POST /auth/login')[0]?.body).toMatchObject({ email: 'ada@example.com' });
  });

  it('see a clear message for wrong credentials and stay on the page', async () => {
    stubApi({
      'POST /auth/refresh': signedOut,
      'GET /auth/providers': noGoogle,
      'POST /auth/login': () => failure(401, 'UNAUTHENTICATED', 'Invalid email or password'),
    });
    const router = renderRoutes(appRoutes, ['/login'], { auth: 'real' });

    await signInWith('ada@example.com', 'wrong-password');

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(router.state.location.pathname).toBe('/login');
  });

  it('are told what is missing without a request being sent', async () => {
    const stub = stubApi({ 'POST /auth/refresh': signedOut, 'GET /auth/providers': noGoogle });
    renderRoutes(appRoutes, ['/login'], { auth: 'real' });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Enter your email')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(stub.callsTo('POST /auth/login')).toHaveLength(0);
  });

  it('can reveal the password they are typing', async () => {
    stubApi({ 'POST /auth/refresh': signedOut, 'GET /auth/providers': noGoogle });
    renderRoutes(appRoutes, ['/login'], { auth: 'real' });
    const user = userEvent.setup();

    const field = await screen.findByLabelText('Password');
    expect(field).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(field).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

describe('registration', () => {
  it('checks the password length locally', async () => {
    const stub = stubApi({ 'POST /auth/refresh': signedOut, 'GET /auth/providers': noGoogle });
    renderRoutes(appRoutes, ['/register'], { auth: 'real' });
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Name'), 'Ada');
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Use at least 10 characters')).toBeInTheDocument();
    expect(stub.callsTo('POST /auth/register')).toHaveLength(0);
  });

  it('puts an existing-email conflict under the email field', async () => {
    stubApi({
      'POST /auth/refresh': signedOut,
      'GET /auth/providers': noGoogle,
      'POST /auth/register': () =>
        failure(409, 'CONFLICT', 'An account with this email already exists'),
    });
    renderRoutes(appRoutes, ['/register'], { auth: 'real' });
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Name'), 'Ada');
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'long enough password');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText(/already exists/)).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('signs the new person straight in', async () => {
    const stub = stubApi({
      'POST /auth/refresh': signedOut,
      'GET /auth/providers': noGoogle,
      'POST /auth/register': () => session(),
      'GET /health': health,
    });
    renderRoutes(appRoutes, ['/register'], { auth: 'real' });
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Name'), 'Ada');
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'long enough password');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    expect(stub.callsTo('POST /auth/register')[0]?.body).toEqual({
      name: 'Ada',
      email: 'ada@example.com',
      password: 'long enough password',
    });
  });
});

describe('returning visitors', () => {
  it('are signed in from the refresh cookie without seeing the sign-in page', async () => {
    const stub = stubApi({ 'POST /auth/refresh': () => session(), 'GET /health': health });
    renderRoutes(appRoutes, ['/'], { auth: 'real' });

    expect(await screen.findByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Account menu for Ada Lovelace' }),
    ).toBeInTheDocument();

    // The health request carries the token the refresh returned.
    await waitFor(() => expect(stub.callsTo('GET /health')).toHaveLength(1));
    expect(stub.callsTo('GET /health')[0]?.headers.Authorization).toBe('Bearer tok-1');
  });

  it('are moved off the sign-in page when already signed in', async () => {
    stubApi({ 'POST /auth/refresh': () => session(), 'GET /health': health });
    const router = renderRoutes(appRoutes, ['/login'], { auth: 'real' });

    expect(await screen.findByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('get a retry screen, not a sign-in page, when the server cannot be reached', async () => {
    let online = false;
    stubApi({
      'POST /auth/refresh': () => {
        if (!online) throw new TypeError('Failed to fetch');
        return session();
      },
      'GET /health': health,
    });
    renderRoutes(appRoutes, ['/projects'], { auth: 'real' });
    const user = userEvent.setup();

    expect(await screen.findByRole('alert')).toHaveTextContent('Can’t check your sign-in');
    expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument();

    online = true;
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Projects' })).toBeInTheDocument();
  });
});

describe('signing out', () => {
  it('ends the session on the server and returns to the sign-in page', async () => {
    const stub = stubApi({
      'POST /auth/refresh': () => session(),
      'POST /auth/logout': noContent,
      'GET /auth/providers': noGoogle,
    });
    renderRoutes(appRoutes, ['/projects'], { auth: 'real' });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Account menu for Ada Lovelace' }));
    const menu = screen.getByRole('menu', { name: 'Account' });
    expect(within(menu).getByText('ada@example.com')).toBeInTheDocument();
    await user.click(within(menu).getByRole('menuitem', { name: 'Sign out' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    expect(stub.callsTo('POST /auth/logout')).toHaveLength(1);
    expect(stub.callsTo('POST /auth/logout')[0]?.headers['X-CSRF-Token']).toBe('1');
  });

  it('still signs out in this browser when the server cannot be reached', async () => {
    stubApi({
      'POST /auth/refresh': () => session(),
      'POST /auth/logout': () => {
        throw new TypeError('Failed to fetch');
      },
      'GET /auth/providers': noGoogle,
    });
    renderRoutes(appRoutes, ['/projects'], { auth: 'real' });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Account menu for Ada Lovelace' }));
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
  });
});

describe('Google sign-in', () => {
  it('offers the button only when the API has it configured', async () => {
    stubApi({ 'POST /auth/refresh': signedOut, 'GET /auth/providers': () => ok({ google: true }) });
    renderRoutes(appRoutes, ['/login'], { auth: 'real' });

    const link = await screen.findByRole('link', { name: 'Continue with Google' });
    expect(link).toHaveAttribute('href', 'http://localhost:5000/api/v1/auth/google');
  });

  it('hides it otherwise', async () => {
    stubApi({ 'POST /auth/refresh': signedOut, 'GET /auth/providers': noGoogle });
    renderRoutes(appRoutes, ['/login'], { auth: 'real' });

    await screen.findByRole('button', { name: 'Sign in' });
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: 'Continue with Google' })).not.toBeInTheDocument(),
    );
  });

  it('keeps the email form usable if the provider check fails', async () => {
    stubApi({
      'POST /auth/refresh': signedOut,
      'GET /auth/providers': () => failure(500, 'INTERNAL_ERROR', 'Something went wrong'),
    });
    renderRoutes(appRoutes, ['/login'], { auth: 'real' });

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('explains what happened when Google sends the browser back with an error', async () => {
    stubApi({ 'POST /auth/refresh': signedOut, 'GET /auth/providers': noGoogle });
    renderRoutes(appRoutes, ['/login?error=google_failed'], { auth: 'real' });

    expect(await screen.findByRole('alert')).toHaveTextContent(/google sign-in did not finish/i);
  });
});
