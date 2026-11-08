import { describe, expect, it } from 'vitest';
import { validateLevel } from './board';
import { DIFFICULTIES, LEVELS_PER_DIFFICULTY } from './difficulty';
import { buildLevel, levelParams } from './levels';
import { isSolvable } from './solver';

describe('levelParams', () => {
  it('starts Easy at 10x10 on one layer (FR-15)', () => {
    const p = levelParams(0, 1);
    expect([p.width, p.height, p.layers]).toEqual([10, 10, 1]);
  });

  it('uses the layer count of each difficulty', () => {
    DIFFICULTIES.forEach((d, i) => {
      expect(levelParams(i, 50).layers).toBe(d.layers);
    });
  });

  it('never shrinks the board as the level number rises', () => {
    for (let d = 0; d < DIFFICULTIES.length; d++) {
      let prev = 0;
      for (let l = 1; l <= LEVELS_PER_DIFFICULTY; l++) {
        const side = levelParams(d, l).width;
        expect(side).toBeGreaterThanOrEqual(prev);
        prev = side;
      }
    }
  });

  it('never lowers the arrow target as the level number rises', () => {
    for (let d = 0; d < DIFFICULTIES.length; d++) {
      let prev = 0;
      for (let l = 1; l <= LEVELS_PER_DIFFICULTY; l++) {
        const n = levelParams(d, l).arrows;
        expect(n).toBeGreaterThanOrEqual(prev);
        prev = n;
      }
    }
  });

  it('gives every one of the 500 levels its own seed', () => {
    const seeds = new Set<number>();
    for (let d = 0; d < DIFFICULTIES.length; d++) {
      for (let l = 1; l <= LEVELS_PER_DIFFICULTY; l++) {
        seeds.add(levelParams(d, l).seed);
      }
    }
    expect(seeds.size).toBe(500);
  });

  it('rejects levels outside 1 to 100 and unknown difficulties', () => {
    expect(() => levelParams(0, 0)).toThrow(RangeError);
    expect(() => levelParams(0, 101)).toThrow(RangeError);
    expect(() => levelParams(5, 1)).toThrow(RangeError);
  });
});

describe('buildLevel', () => {
  it('is repeatable', () => {
    expect(buildLevel(1, 7)).toEqual(buildLevel(1, 7));
  });

  it.each([0, 1, 2, 3, 4])(
    'first, middle and last level of difficulty %i are valid and solvable',
    (d) => {
      for (const l of [1, 50, 100]) {
        const level = buildLevel(d, l);
        expect(validateLevel(level)).toEqual([]);
        expect(isSolvable(level)).toBe(true);
      }
    },
  );
});

describe('difficulty curve', () => {
  const mean = (d: number, from: number, to: number): number => {
    let sum = 0;
    for (let l = from; l <= to; l++) sum += buildLevel(d, l).arrows.length;
    return sum / (to - from + 1);
  };

  it.each([0, 1, 2, 3, 4])(
    'difficulty %i has more arrows at the end than at the start',
    (d) => {
      expect(mean(d, 91, 100)).toBeGreaterThan(mean(d, 1, 10));
    },
  );

  it('every fifth level of every difficulty is valid and solvable', () => {
    for (let d = 0; d < DIFFICULTIES.length; d++) {
      for (let l = 5; l <= LEVELS_PER_DIFFICULTY; l += 5) {
        const level = buildLevel(d, l);
        expect(validateLevel(level)).toEqual([]);
        expect(isSolvable(level)).toBe(true);
      }
    }
  }, 60000);
});
