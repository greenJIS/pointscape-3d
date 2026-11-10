import { useEffect } from 'react';
import { flushSync } from 'react-dom';
import type { ThemeMode } from './settings';

/** Whether the dark look is on. Keeps `<html data-theme>` and the browser's theme colour in step. */
export function useDark(mode: ThemeMode): boolean {
  const dark = mode === 'dark';
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', dark ? '#020617' : '#f1f5f9');
  }, [dark]);
  return dark;
}

/**
 * Runs `apply` (which changes the theme) inside a circular reveal that starts at `from`.
 * Browsers without view transitions, and people who asked for less motion, get an instant switch.
 */
export function revealTheme(from: HTMLElement, apply: () => void): void {
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || typeof document.startViewTransition !== 'function') {
    apply();
    return;
  }
  const r = from.getBoundingClientRect();
  root.style.setProperty('--theme-x', `${r.left + r.width / 2}px`);
  root.style.setProperty('--theme-y', `${r.top + r.height / 2}px`);
  document.startViewTransition(() => flushSync(apply));
}
