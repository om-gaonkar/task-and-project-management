import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../../modules/auth/password';

describe('password hashing', () => {
  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
    expect(await verifyPassword('correct horse battery stapl', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
  });

  it('salts every hash and stores its parameters', async () => {
    const [a, b] = await Promise.all([
      hashPassword('same password'),
      hashPassword('same password'),
    ]);
    expect(a).not.toBe(b);
    expect(a).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(a).not.toContain('same password');
  });

  it('treats visually identical unicode as the same password', async () => {
    const hash = await hashPassword('caf\u00e9-password'); // precomposed é
    expect(await verifyPassword('cafe\u0301-password', hash)).toBe(true); // e + combining accent
  });

  it('rejects malformed stored hashes instead of throwing', async () => {
    expect(await verifyPassword('x', '')).toBe(false);
    expect(await verifyPassword('x', 'bcrypt$10$abc$def')).toBe(false);
    expect(await verifyPassword('x', 'scrypt$32768$8$1$onlysalt')).toBe(false);
  });
});
