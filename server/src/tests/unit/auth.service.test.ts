import { beforeEach, describe, expect, it } from 'vitest';
import { createAuthService, toPublicUser, type AuthConfig } from '../../modules/auth/auth.service';
import type { DeviceInfo, GoogleProfile } from '../../modules/auth/auth.types';
import { hashPassword } from '../../modules/auth/password';
import { createMemorySessions, createMemoryUsers } from '../helpers/memory-repositories';

const DAY = 24 * 60 * 60 * 1000;
const device: DeviceInfo = {
  userAgent: 'test',
  browser: 'Chrome 126',
  os: 'Linux',
  deviceType: 'desktop',
  ipAddress: '203.0.113.5',
};

const config: AuthConfig = {
  accessSecret: 'a'.repeat(40),
  refreshSecret: 'b'.repeat(40),
  accessTtlSeconds: 900,
  refreshTtlMs: 7 * DAY,
  sessionMaxMs: 30 * DAY,
};

const silent = { warn: () => undefined, info: () => undefined };
const registration = { name: 'Ada', email: 'ada@example.com', password: 'a-long-enough-password' };

function setup(overrides: Partial<AuthConfig> = {}) {
  const users = createMemoryUsers();
  const sessions = createMemorySessions();
  const clock = { now: new Date('2026-11-04T10:00:00Z') };
  const service = createAuthService({
    users: users.repository,
    sessions: sessions.repository,
    config: { ...config, ...overrides },
    logger: silent,
    now: () => clock.now,
  });
  const advance = (ms: number) => {
    clock.now = new Date(clock.now.getTime() + ms);
  };
  return { service, users, sessions, advance };
}

const google = (overrides: Partial<GoogleProfile> = {}): GoogleProfile => ({
  googleId: 'g-123',
  email: 'ada@example.com',
  emailVerified: true,
  name: 'Ada L',
  avatarUrl: 'https://lh3.example/a.png',
  ...overrides,
});

describe('register and login', () => {
  it('creates an account and signs the person in without exposing the hash', async () => {
    const { service, users } = setup();
    const result = await service.register(registration, device);

    expect(result.user).toMatchObject({
      name: 'Ada',
      email: 'ada@example.com',
      providers: ['password'],
    });
    expect(JSON.stringify(result.user)).not.toMatch(/scrypt|passwordHash/);
    expect(result.session.accessToken).toBeTruthy();
    expect(result.session.refreshToken).toBeTruthy();
    expect([...users.rows.values()][0]?.passwordHash).toMatch(/^scrypt\$/);
    expect([...users.rows.values()][0]?.emailVerified).toBe(false);
  });

  it('refuses a second account for the same email, whatever its case', async () => {
    const { service } = setup();
    await service.register(registration, device);
    await expect(
      service.register({ ...registration, email: 'ADA@example.com' }, device),
    ).rejects.toMatchObject({ statusCode: 409, code: 'CONFLICT' });
  });

  it('signs in with the right password', async () => {
    const { service } = setup();
    await service.register(registration, device);
    const result = await service.login(
      { email: 'ada@example.com', password: registration.password },
      device,
    );
    expect(result.user.email).toBe('ada@example.com');
  });

  it('gives the same error for a wrong password, an unknown email and a Google-only account', async () => {
    const { service } = setup();
    await service.register(registration, device);
    await service.loginWithGoogle(
      google({ email: 'grace@example.com', googleId: 'g-grace' }),
      device,
    );

    const attempts = [
      { email: 'ada@example.com', password: 'wrong-password-here' },
      { email: 'nobody@example.com', password: 'wrong-password-here' },
      { email: 'grace@example.com', password: 'wrong-password-here' },
    ];
    for (const attempt of attempts) {
      await expect(service.login(attempt, device)).rejects.toMatchObject({
        statusCode: 401,
        message: 'Invalid email or password',
      });
    }
  });

  it('rejects a disabled account only after the password was right', async () => {
    const { service, users } = setup();
    await service.register(registration, device);
    const user = [...users.rows.values()][0]!;
    users.rows.set(user.id, { ...user, isActive: false });

    await expect(
      service.login({ email: 'ada@example.com', password: registration.password }, device),
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      service.login({ email: 'ada@example.com', password: 'wrong-password-here' }, device),
    ).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe('refresh token rotation', () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup();
  });

  it('issues a new token in the same session and retires the old one', async () => {
    const first = await ctx.service.register(registration, device);
    const second = await ctx.service.refresh(first.session.refreshToken, device);

    expect(second.session.refreshToken).not.toBe(first.session.refreshToken);
    expect(second.user.email).toBe('ada@example.com');

    const rows = [...ctx.sessions.rows.values()];
    expect(new Set(rows.map((row) => row.familyId)).size).toBe(1);
    expect(rows.map((row) => row.status).sort()).toEqual(['active', 'used']);

    const claims = await ctx.service.authenticate(second.session.accessToken);
    expect(claims.userId).toBe(second.user.id);
  });

  it('keeps working across many rotations', async () => {
    let { session } = await ctx.service.register(registration, device);
    for (let i = 0; i < 5; i += 1) {
      ctx.advance(60_000);
      session = (await ctx.service.refresh(session.refreshToken, device)).session;
    }
    await expect(ctx.service.authenticate(session.accessToken)).resolves.toBeTruthy();
  });

  it('treats a reused token as theft and ends the whole session', async () => {
    const first = await ctx.service.register(registration, device);
    const second = await ctx.service.refresh(first.session.refreshToken, device);

    await expect(ctx.service.refresh(first.session.refreshToken, device)).rejects.toMatchObject({
      statusCode: 401,
    });

    // The thief's attempt also kills the legitimate holder's newer token and access token.
    await expect(ctx.service.refresh(second.session.refreshToken, device)).rejects.toMatchObject({
      statusCode: 401,
    });
    await expect(ctx.service.authenticate(second.session.accessToken)).rejects.toMatchObject({
      code: 'SESSION_REVOKED',
    });
  });

  it('does not touch other sessions of the same user when one is compromised', async () => {
    const laptop = await ctx.service.register(registration, device);
    const phone = await ctx.service.login(
      { email: 'ada@example.com', password: registration.password },
      device,
    );
    const rotated = await ctx.service.refresh(laptop.session.refreshToken, device);
    await expect(ctx.service.refresh(laptop.session.refreshToken, device)).rejects.toThrow();

    await expect(ctx.service.authenticate(phone.session.accessToken)).resolves.toBeTruthy();
    await expect(ctx.service.refresh(phone.session.refreshToken, device)).resolves.toBeTruthy();
    await expect(ctx.service.authenticate(rotated.session.accessToken)).rejects.toThrow();
  });

  it('lets only one of two simultaneous refreshes win, then ends the session', async () => {
    const { session } = await ctx.service.register(registration, device);
    const results = await Promise.allSettled([
      ctx.service.refresh(session.refreshToken, device),
      ctx.service.refresh(session.refreshToken, device),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected']);
    const winner = results.find((result) => result.status === 'fulfilled');
    if (winner?.status !== 'fulfilled') throw new Error('expected a winner');
    await expect(ctx.service.authenticate(winner.value.session.accessToken)).rejects.toThrow();
  });

  it('rejects unknown and garbage tokens', async () => {
    await expect(ctx.service.refresh('not-a-real-token', device)).rejects.toMatchObject({
      statusCode: 401,
    });
    await expect(ctx.service.refresh('', device)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('expires an idle refresh token after its sliding window', async () => {
    const { session } = await ctx.service.register(registration, device);
    ctx.advance(7 * DAY + 1000);
    await expect(ctx.service.refresh(session.refreshToken, device)).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('caps a session at its absolute lifetime however often it is refreshed', async () => {
    let { session } = await ctx.service.register(registration, device);
    // Active every 6 days, so the sliding window never lapses.
    for (let day = 6; day <= 24; day += 6) {
      ctx.advance(6 * DAY);
      session = (await ctx.service.refresh(session.refreshToken, device)).session;
    }
    ctx.advance(6 * DAY); // day 30: the last token was capped to the session end
    const capped = [...ctx.sessions.rows.values()].find((row) => row.status === 'active');
    expect(capped?.expiresAt.getTime()).toBeLessThanOrEqual(capped!.sessionExpiresAt.getTime());
    ctx.advance(1000);
    await expect(ctx.service.refresh(session.refreshToken, device)).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('ends the session when the account is disabled', async () => {
    const { session, user } = await ctx.service.register(registration, device);
    const record = ctx.users.rows.get(user.id)!;
    ctx.users.rows.set(user.id, { ...record, isActive: false });
    await expect(ctx.service.refresh(session.refreshToken, device)).rejects.toMatchObject({
      statusCode: 401,
    });
    await expect(ctx.service.authenticate(session.accessToken)).rejects.toMatchObject({
      code: 'SESSION_REVOKED',
    });
  });
});

describe('access tokens', () => {
  it('reports an expired token distinctly so the client knows to refresh', async () => {
    const { service } = setup({ accessTtlSeconds: -5 });
    const { session } = await service.register(registration, device);
    await expect(service.authenticate(session.accessToken)).rejects.toMatchObject({
      statusCode: 401,
      code: 'ACCESS_TOKEN_EXPIRED',
    });
  });

  it('rejects garbage', async () => {
    const { service } = setup();
    await expect(service.authenticate('garbage')).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe('signing out and managing sessions', () => {
  it('logout revokes the session and works for unknown or missing tokens', async () => {
    const { service } = setup();
    const { session } = await service.register(registration, device);

    await service.logout(session.refreshToken);
    await expect(service.authenticate(session.accessToken)).rejects.toMatchObject({
      code: 'SESSION_REVOKED',
    });
    await expect(service.refresh(session.refreshToken, device)).rejects.toThrow();

    await expect(service.logout('unknown')).resolves.toBeUndefined();
    await expect(service.logout(undefined)).resolves.toBeUndefined();
  });

  it('logoutAll ends every session of that user and nobody else’s', async () => {
    const { service } = setup();
    const ada1 = await service.register(registration, device);
    const ada2 = await service.login(
      { email: 'ada@example.com', password: registration.password },
      device,
    );
    const other = await service.register(
      { ...registration, email: 'bob@example.com', name: 'Bob' },
      device,
    );

    await service.logoutAll(ada1.user.id);

    await expect(service.authenticate(ada1.session.accessToken)).rejects.toThrow();
    await expect(service.authenticate(ada2.session.accessToken)).rejects.toThrow();
    await expect(service.authenticate(other.session.accessToken)).resolves.toBeTruthy();
  });

  it('lists active sessions, marks the current one, and revokes a chosen one', async () => {
    const { service } = setup();
    const laptop = await service.register(registration, device);
    const phone = await service.login(
      { email: 'ada@example.com', password: registration.password },
      {
        ...device,
        deviceType: 'mobile',
      },
    );
    const laptopId = (await service.authenticate(laptop.session.accessToken)).sessionId;
    const phoneId = (await service.authenticate(phone.session.accessToken)).sessionId;

    const listed = await service.listSessions(laptop.user.id, laptopId);
    expect(listed).toHaveLength(2);
    expect(listed.find((row) => row.id === laptopId)?.isCurrent).toBe(true);
    expect(listed.find((row) => row.id === phoneId)?.isCurrent).toBe(false);
    expect(JSON.stringify(listed)).not.toMatch(/tokenHash|userAgent/);

    await service.revokeSession(laptop.user.id, phoneId);
    await expect(service.authenticate(phone.session.accessToken)).rejects.toThrow();
    expect(await service.listSessions(laptop.user.id, laptopId)).toHaveLength(1);
  });

  it('answers not-found for a session that is not yours, same as one that does not exist', async () => {
    const { service } = setup();
    const ada = await service.register(registration, device);
    const bob = await service.register(
      { ...registration, email: 'bob@example.com', name: 'Bob' },
      device,
    );
    const bobSession = (await service.authenticate(bob.session.accessToken)).sessionId;

    await expect(service.revokeSession(ada.user.id, bobSession)).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(service.revokeSession(ada.user.id, 'f'.repeat(32))).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(service.authenticate(bob.session.accessToken)).resolves.toBeTruthy();
  });
});

describe('Google sign-in', () => {
  it('creates a verified account for a new Google user', async () => {
    const { service, users } = setup();
    const result = await service.loginWithGoogle(google(), device);

    expect(result.user).toMatchObject({
      email: 'ada@example.com',
      providers: ['google'],
      avatarUrl: 'https://lh3.example/a.png',
    });
    const stored = [...users.rows.values()][0];
    expect(stored?.emailVerified).toBe(true);
    expect(stored?.passwordHash).toBeUndefined();
  });

  it('recognises a returning Google user by id even if their email changed', async () => {
    const { service, users } = setup();
    await service.loginWithGoogle(google(), device);
    await service.loginWithGoogle(google({ email: 'new-address@example.com' }), device);
    expect(users.rows.size).toBe(1);
  });

  it('refuses an email Google has not verified', async () => {
    const { service } = setup();
    await expect(
      service.loginWithGoogle(google({ emailVerified: false }), device),
    ).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('refuses to link an email already tied to a different Google account', async () => {
    const { service } = setup();
    await service.loginWithGoogle(google(), device);
    await expect(
      service.loginWithGoogle(google({ googleId: 'g-other' }), device),
    ).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('pre-hijacking: claiming an unverified password account removes the password and its sessions', async () => {
    const { service, users } = setup();
    // An attacker registers the victim's address before the victim ever signs in.
    const attacker = await service.register(registration, device);

    const victim = await service.loginWithGoogle(google(), device);

    expect(victim.user.providers).toEqual(['google']);
    expect(users.rows.size).toBe(1);
    await expect(
      service.login({ email: 'ada@example.com', password: registration.password }, device),
    ).rejects.toMatchObject({ statusCode: 401 });
    await expect(service.authenticate(attacker.session.accessToken)).rejects.toMatchObject({
      code: 'SESSION_REVOKED',
    });
    await expect(service.refresh(attacker.session.refreshToken, device)).rejects.toThrow();
  });

  it('keeps the password when it belongs to a verified email', async () => {
    const { service, users } = setup();
    const passwordHash = await hashPassword('a-long-enough-password');
    await users.repository.create({
      name: 'Ada',
      email: 'ada@example.com',
      passwordHash,
      emailVerified: true,
    });

    const result = await service.loginWithGoogle(google(), device);

    expect(result.user.providers).toEqual(['password', 'google']);
    await expect(
      service.login({ email: 'ada@example.com', password: 'a-long-enough-password' }, device),
    ).resolves.toBeTruthy();
  });

  it('signs a disabled Google account out', async () => {
    const { service, users } = setup();
    await service.loginWithGoogle(google(), device);
    const user = [...users.rows.values()][0]!;
    users.rows.set(user.id, { ...user, isActive: false });
    await expect(service.loginWithGoogle(google(), device)).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});

describe('toPublicUser', () => {
  it('never includes credentials', () => {
    const dto = toPublicUser({
      id: '1',
      name: 'Ada',
      email: 'ada@example.com',
      passwordHash: 'scrypt$secret',
      googleId: 'g',
      emailVerified: true,
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
    expect(Object.keys(dto).sort()).toEqual([
      'avatarUrl',
      'createdAt',
      'email',
      'id',
      'name',
      'providers',
    ]);
    expect(JSON.stringify(dto)).not.toContain('secret');
  });
});
