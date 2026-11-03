import { useCallback, useState } from 'react';

/**
 * useState backed by localStorage, for small UI preferences only (never tokens or user data).
 * Storage can be unavailable or corrupt, so every access is guarded.
 */
export function usePersistentState<T>(
  key: string,
  initial: T | (() => T),
): [T, (value: T) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) return JSON.parse(raw) as T;
    } catch {
      // Fall through to the default.
    }
    return typeof initial === 'function' ? (initial as () => T)() : initial;
  });

  const setValue = useCallback(
    (value: T) => {
      setState(value);
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // The preference simply will not persist.
      }
    },
    [key],
  );

  return [state, setValue];
}
