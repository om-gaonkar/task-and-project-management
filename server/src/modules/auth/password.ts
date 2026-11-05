import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

/**
 * scrypt from node:crypto: memory-hard, runs on the libuv thread pool and needs no native build,
 * which keeps deployment simple. Parameters are stored in the hash so they can be raised later.
 * N=2^15, r=8 uses about 32 MB per hash.
 */
const N = 32768;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

function derive(
  password: string,
  salt: Buffer,
  n: number,
  r: number,
  p: number,
  keyLength: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize('NFKC'),
      salt,
      keyLength,
      { N: n, r, p, maxmem: 256 * n * r },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(password, salt, N, R, P, KEY_LENGTH);
  return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, key] = stored.split('$');
  if (scheme !== 'scrypt' || !n || !r || !p || !salt || !key) return false;
  const expected = Buffer.from(key, 'base64');
  const actual = await derive(
    password,
    Buffer.from(salt, 'base64'),
    Number(n),
    Number(r),
    Number(p),
    expected.length,
  );
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

let dummyHash: Promise<string> | undefined;

/**
 * Verifies against a throwaway hash so an unknown email costs as much time as a wrong password,
 * which stops response timing from revealing which emails have accounts.
 */
export async function verifyAgainstDummy(password: string): Promise<void> {
  dummyHash ??= hashPassword('not-a-real-password');
  await verifyPassword(password, await dummyHash);
}
