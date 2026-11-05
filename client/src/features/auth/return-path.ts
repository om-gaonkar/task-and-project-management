const AUTH_PAGES = ['/login', '/register'];

/**
 * Where to go after signing in. Only same-site paths are accepted, so a crafted link cannot
 * turn the login page into an open redirect ("//evil.example" and "/\evil.example" are both
 * read by browsers as another host).
 */
export function safeReturnPath(value: unknown): string {
  if (typeof value !== 'string') return '/';
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/';
  if (AUTH_PAGES.some((page) => value === page || value.startsWith(`${page}?`))) return '/';
  return value;
}
