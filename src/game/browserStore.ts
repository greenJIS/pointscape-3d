import type { KeyValueStore } from './storage';

/**
 * `localStorage`, or a copy in memory when the browser blocks it (Safari with all cookies
 * blocked, some sandboxed frames). Even looking up `localStorage` can throw there.
 */
export function browserStore(): KeyValueStore {
  try {
    const store = window.localStorage;
    const probe = 'pointscape-3d:probe';
    store.setItem(probe, '1');
    store.removeItem(probe);
    return store;
  } catch {
    const memory = new Map<string, string>();
    return {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => void memory.set(key, value),
    };
  }
}
