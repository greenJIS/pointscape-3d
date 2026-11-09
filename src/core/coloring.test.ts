import { describe, expect, it } from 'vitest';
import { assignColors, neighbours } from './coloring';
import { buildLevel } from './levels';

describe('assignColors', () => {
  it('is the same every time for a level and seed (FR-36)', () => {
    const level = buildLevel(0, 1, 5);
    expect(assignColors(level, 5, 7)).toEqual(assignColors(level, 5, 7));
  });

  it('keeps most touching arrows apart on a crowded board', () => {
    const level = buildLevel(0, 1, 40);
    const colors = assignColors(level, 5, 1);
    let pairs = 0;
    let same = 0;
    for (const [id, near] of neighbours(level)) {
      for (const n of near) {
        if (n < id) continue;
        pairs++;
        if (colors.get(id) === colors.get(n)) same++;
      }
    }
    expect(pairs).toBeGreaterThan(0);
    expect(same / pairs).toBeLessThan(0.05);
  });

  it('colours every arrow inside the pool', () => {
    const level = buildLevel(2, 3, 10);
    const colors = assignColors(level, 5, 3);
    expect(colors.size).toBe(level.arrows.length);
    for (const c of colors.values()) expect(c).toBeLessThan(5);
  });
});
