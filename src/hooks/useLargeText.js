import { useState, useEffect, useCallback } from 'react';

/**
 * useLargeText — persist a "big text" accessibility preference.
 * Toggles html.large-text class and stores the choice in localStorage
 * (key `dp-large-text`, value "1" or absent).
 *
 * Returns: [enabled, toggle]
 */
const STORAGE_KEY = 'dp-large-text';

export function useLargeText() {
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  // Keep html class + storage in sync
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (enabled) {
      root.classList.add('large-text');
      try { window.localStorage.setItem(STORAGE_KEY, '1'); } catch {}
    } else {
      root.classList.remove('large-text');
      try { window.localStorage.removeItem(STORAGE_KEY); } catch {}
    }
  }, [enabled]);

  const toggle = useCallback(() => setEnabled(prev => !prev), []);

  return [enabled, toggle];
}

export default useLargeText;
