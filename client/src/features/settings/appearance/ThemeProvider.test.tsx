import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { ThemeProvider } from './ThemeProvider';
import { THEME_STORAGE_KEY, useTheme } from './theme-context';

function mockSystemTheme(initialDark: boolean) {
  let matches = initialDark;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const query = {
    get matches() {
      return matches;
    },
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    },
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  } as unknown as MediaQueryList;

  window.matchMedia = () => query;

  return {
    setDark(next: boolean) {
      matches = next;
      listeners.forEach((listener) => listener({ matches } as MediaQueryListEvent));
    },
  };
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);
const isDark = () => document.documentElement.classList.contains('dark');

describe('ThemeProvider', () => {
  it('follows the operating system by default', () => {
    mockSystemTheme(true);
    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.mode).toBe('system');
    expect(result.current.resolved).toBe('dark');
    expect(isDark()).toBe(true);
  });

  it('applies an explicit choice immediately and persists it', () => {
    mockSystemTheme(false);
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => result.current.setMode('dark'));
    expect(isDark()).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    act(() => result.current.setMode('light'));
    expect(isDark()).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('restores a stored preference over the system setting', () => {
    mockSystemTheme(false);
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');

    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.mode).toBe('dark');
    expect(isDark()).toBe(true);
  });

  it('ignores an invalid stored value', () => {
    mockSystemTheme(false);
    window.localStorage.setItem(THEME_STORAGE_KEY, 'purple');

    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.mode).toBe('system');
  });

  it('tracks operating-system changes only while in system mode', () => {
    const system = mockSystemTheme(false);
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => system.setDark(true));
    expect(result.current.resolved).toBe('dark');

    act(() => result.current.setMode('light'));
    act(() => system.setDark(false));
    act(() => system.setDark(true));
    expect(result.current.resolved).toBe('light');
    expect(isDark()).toBe(false);
  });
});
