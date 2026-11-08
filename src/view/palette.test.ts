import { describe, expect, it } from 'vitest';
import { oneColorFor, POOL } from './palette';

describe('oneColorFor', () => {
  it('is stable for a level and comes from the pool (FR-35)', () => {
    expect(oneColorFor(2, 17)).toBe(oneColorFor(2, 17));
    expect(POOL).toContain(oneColorFor(2, 17));
  });

  it('uses more than one colour across levels', () => {
    const seen = new Set<string>();
    for (let l = 1; l <= 100; l++) seen.add(oneColorFor(0, l));
    expect(seen.size).toBe(POOL.length);
  });
});
