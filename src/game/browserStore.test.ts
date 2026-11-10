import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserStore } from './browserStore';

afterEach(() => vi.unstubAllGlobals());

describe('browserStore', () => {
  it('falls back to memory when localStorage throws', () => {
    vi.stubGlobal('window', {
      get localStorage(): never {
        throw new DOMException('blocked', 'SecurityError');
      },
    });
    const store = browserStore();
    expect(store.getItem('a')).toBeNull();
    store.setItem('a', '1');
    expect(store.getItem('a')).toBe('1');
  });

  it('falls back when writing is refused', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => null,
        removeItem: () => undefined,
        setItem: () => {
          throw new DOMException('full', 'QuotaExceededError');
        },
      },
    });
    const store = browserStore();
    store.setItem('b', '2');
    expect(store.getItem('b')).toBe('2');
  });

  it('uses localStorage when it works', () => {
    const data = new Map<string, string>();
    const real = {
      getItem: (k: string) => data.get(k) ?? null,
      removeItem: (k: string) => void data.delete(k),
      setItem: (k: string, v: string) => void data.set(k, v),
    };
    vi.stubGlobal('window', { localStorage: real });
    expect(browserStore()).toBe(real);
  });
});
