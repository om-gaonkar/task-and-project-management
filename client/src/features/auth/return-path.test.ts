import { describe, expect, it } from 'vitest';
import { safeReturnPath } from './return-path';

describe('safeReturnPath', () => {
  it('keeps ordinary in-app paths, including query strings', () => {
    expect(safeReturnPath('/projects')).toBe('/projects');
    expect(safeReturnPath('/tasks?status=open')).toBe('/tasks?status=open');
  });

  it.each([
    ['a protocol-relative URL', '//evil.example'],
    ['a backslash trick', '/\\evil.example'],
    ['an absolute URL', 'https://evil.example'],
    ['a javascript URL', 'javascript:alert(1)'],
    ['a relative path', 'projects'],
    ['nothing', undefined],
    ['a non-string', { path: '/projects' }],
  ])('falls back to the overview for %s', (_name, value) => {
    expect(safeReturnPath(value)).toBe('/');
  });

  it('never returns to the sign-in pages', () => {
    expect(safeReturnPath('/login')).toBe('/');
    expect(safeReturnPath('/login?error=google_failed')).toBe('/');
    expect(safeReturnPath('/register')).toBe('/');
  });
});
