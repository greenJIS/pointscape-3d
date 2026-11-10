import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../game/settings';
import { BLOCKED, POOL } from './palette';

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const token = (name: string): string | undefined =>
  new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6});`, 'i').exec(css)?.[1];

describe('POOL', () => {
  it('holds the default one-color choice', () => {
    expect(POOL).toContain(defaultSettings().oneColor);
  });

  it('matches the colour scheme in index.css', () => {
    const names = ['orange', 'yellow', 'teal', 'indigo', 'magenta'];
    expect(POOL).toEqual(names.map((n) => token(`pool-${n}`)));
    expect(BLOCKED).toBe(token('blocked'));
  });
});
