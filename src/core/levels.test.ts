import { describe, expect, it } from 'vitest';
import { validateLevel } from './board';
import {
  DIFFICULTIES,
  LAYER_COUNTS,
  LEVELS_PER_TRACK,
  TRACK_COUNT,
} from './difficulty';
import { complexityOf } from './complexity';
import { buildLevel, levelParams } from './levels';
import { isSolvable } from './solver';

const SIDES = [8, 12, 18, 24, 32];
const tracks: [number, number][] = [];
for (let d = 0; d < DIFFICULTIES.length; d++) {
  for (const l of LAYER_COUNTS) tracks.push([d, l]);
}

describe('levelParams', () => {
  it('sets the grid side from difficulty only: 8, 12, 18, 24, 32', () => {
    DIFFICULTIES.forEach((_, d) => {
      for (const layers of LAYER_COUNTS) {
        for (const level of [1, 50, 100]) {
          const p = levelParams(d, layers, level);
          expect([p.width, p.height]).toEqual([SIDES[d], SIDES[d]]);
        }
      }
    });
  });

  it('sets the layer count from layers only', () => {
    for (let d = 0; d < DIFFICULTIES.length; d++) {
      for (const l of LAYER_COUNTS) {
        expect(levelParams(d, l, 1).layers).toBe(l);
      }
    }
  });

  it('keeps the board the same size as the level number rises', () => {
    for (const [d, layers] of tracks) {
      for (let l = 1; l <= LEVELS_PER_TRACK; l++) {
        expect(levelParams(d, layers, l).width).toBe(SIDES[d]);
      }
    }
  });

  it('never lowers the arrow target as the level number rises', () => {
    for (const [d, layers] of tracks) {
      let prev = 0;
      for (let l = 1; l <= LEVELS_PER_TRACK; l++) {
        const n = levelParams(d, layers, l).arrows;
        expect(n).toBeGreaterThanOrEqual(prev);
        prev = n;
      }
    }
  });

  it('gives every one of the 2500 levels its own seed', () => {
    const seeds = new Set<number>();
    for (const [d, layers] of tracks) {
      for (let l = 1; l <= LEVELS_PER_TRACK; l++) {
        seeds.add(levelParams(d, layers, l).seed);
      }
    }
    expect(seeds.size).toBe(TRACK_COUNT * LEVELS_PER_TRACK);
  });

  it('rejects levels outside 1 to 100 and unknown tracks', () => {
    expect(() => levelParams(0, 1, 0)).toThrow(RangeError);
    expect(() => levelParams(0, 1, 101)).toThrow(RangeError);
    expect(() => levelParams(5, 1, 1)).toThrow(RangeError);
    expect(() => levelParams(0, 6, 1)).toThrow(RangeError);
    expect(() => levelParams(0, 0, 1)).toThrow(RangeError);
  });
});

describe('buildLevel', () => {
  it('is repeatable', () => {
    expect(buildLevel(1, 2, 7)).toEqual(buildLevel(1, 2, 7));
  });

  it.each(tracks)(
    'first, middle and last level of difficulty %i, %iL are valid and solvable',
    (d, layers) => {
      for (const l of [1, 50, 100]) {
        const level = buildLevel(d, layers, l);
        expect(validateLevel(level)).toEqual([]);
        expect(isSolvable(level)).toBe(true);
      }
    },
    60000,
  );
});

describe('complexity curve', () => {
  /** Mean over a range of levels. Arrow count is not part of it. */
  const mean = (
    d: number,
    layers: number,
    from: number,
    to: number,
    pick: (c: ReturnType<typeof complexityOf>) => number,
  ): number => {
    let sum = 0;
    for (let l = from; l <= to; l++) {
      sum += pick(complexityOf(buildLevel(d, layers, l)));
    }
    return sum / (to - from + 1);
  };

  it.each(tracks)(
    'difficulty %i, %iL: the last levels have longer chains than the first',
    (d, layers) => {
      const first = mean(d, layers, 1, 10, (c) => c.depth);
      const last = mean(d, layers, 91, 100, (c) => c.depth);
      expect(last).toBeGreaterThan(first);
    },
    60000,
  );

  it.each(tracks.filter(([, layers]) => layers > 1))(
    'difficulty %i, %iL: more lines cross layers late than early',
    (d, layers) => {
      const first = mean(d, layers, 1, 10, (c) => c.crossing);
      const last = mean(d, layers, 91, 100, (c) => c.crossing);
      expect(last).toBeGreaterThan(first);
    },
    60000,
  );

  it('keeps one-layer levels on one layer', () => {
    for (const l of [1, 50, 100]) {
      expect(complexityOf(buildLevel(2, 1, l)).crossing).toBe(0);
    }
  });

  it('puts some lines across layers on a stacked level', () => {
    expect(complexityOf(buildLevel(1, 3, 100)).crossing).toBeGreaterThan(0);
  });

  it('every twentieth level of every track is valid and solvable', () => {
    for (const [d, layers] of tracks) {
      for (let l = 20; l <= LEVELS_PER_TRACK; l += 20) {
        const level = buildLevel(d, layers, l);
        expect(validateLevel(level)).toEqual([]);
        expect(isSolvable(level)).toBe(true);
      }
    }
  }, 120000);
});
