import { useEffect } from 'react';
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
