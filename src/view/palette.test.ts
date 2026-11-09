import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../game/settings';
import { POOL } from './palette';

describe('POOL', () => {
  it('holds the default one-color choice', () => {
    expect(POOL).toContain(defaultSettings().oneColor);
  });
});
