import { createContext, useContext } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export interface ThemeContextValue {
  /** What the user picked. */
  mode: ThemeMode;
  /** What is actually applied right now (system is resolved to light or dark). */
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
}

/** Must match the key read by the inline script in index.html. */
export const THEME_STORAGE_KEY = 'workspace.theme';

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>');
  return context;
}
