import { describe, expect, it } from 'vitest';
import { freeArrowIds, validateLevel } from './board';
import { generateLevel, type GenParams } from './generator';
import { isSolvable } from './solver';

const base: GenParams = {
  width: 10,
  height: 10,
  layers: 1,
  arrows: 30,
  minLength: 2,
  maxLength: 6,
  bendChance: 0.35,
  longBias: 0.5,
  tangle: 0.5,
  crossChance: 0.3,
  seed: 1,
};

describe('generateLevel', () => {
  it('gives the same level for the same seed (FR-17)', () => {
    expect(generateLevel(base)).toEqual(generateLevel(base));
  });

  it('gives different levels for different seeds', () => {
    expect(generateLevel(base)).not.toEqual(
      generateLevel({ ...base, seed: 2 }),
    );
  });

  it('fills most of the board when asked for more arrows than fit', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const level = generateLevel({ ...base, seed });
      const cells = level.arrows.reduce((n, a) => n + a.cells.length, 0);
      expect(cells).toBeGreaterThanOrEqual(level.width * level.height * 0.5);
    }
  });

  it('keeps most arrows blocked at the start', () => {
    const level = generateLevel(base);
    const free = freeArrowIds(level, level.arrows).length;
    expect(free).toBeLessThan(level.arrows.length * 0.6);
  });

  it.each([1, 2, 3, 4, 5])(
    'is well formed and solvable with %i layer(s)',
    (layers) => {
      for (let seed = 1; seed <= 40; seed++) {
        const level = generateLevel({
          ...base,
          layers,
          width: 10 + layers * 2,
          height: 10 + layers * 2,
          arrows: 20 + layers * 10,
          seed,
        });
        expect(validateLevel(level)).toEqual([]);
        expect(isSolvable(level)).toBe(true);
      }
    },
    60000,
  );
});
