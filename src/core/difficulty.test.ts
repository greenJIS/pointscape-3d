import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, LEVELS_PER_DIFFICULTY } from './difficulty';

describe('difficulty table', () => {
  it('has one layer more per step, starting at 1', () => {
    expect(DIFFICULTIES.map((d) => d.layers)).toEqual([1, 2, 3, 4, 5]);
  });

  it('has 100 levels per difficulty', () => {
    expect(LEVELS_PER_DIFFICULTY).toBe(100);
  });
});
