import { DIFFICULTIES, LEVELS_PER_DIFFICULTY } from './difficulty';
import type { GenParams } from './generator';
import { generateLevel } from './generator';
import type { Level } from './types';

/**
 * Board side at level 1 of each difficulty. Easy is 10 (FR-15). The others are a
 * proposal: smaller than the 14 to 30 of the first demo, because a stacked board
 * is harder to read. Tune by playtest.
 */
const START_SIDE = [10, 12, 14, 16, 18] as const;
/** Cells added to each side between level 1 and level 100. */
const SIDE_GROWTH = 6;

/**
 * Arrow count at level 1 and level 100 of each difficulty. Set a little under what a
 * board holds, so the count rises with the level number instead of wobbling with the
 * random fill. Tune by playtest.
 */
const ARROW_RANGE = [
  [26, 48],
  [95, 165],
  [170, 250],
  [270, 365],
  [380, 485],
] as const;

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Position of a level inside its difficulty, 0 at level 1 and 1 at the last level. */
const progressOf = (level: number): number =>
  (level - 1) / (LEVELS_PER_DIFFICULTY - 1);

export function seedFor(difficulty: number, level: number): number {
  return 1000 + difficulty * 5000 + level * 37;
}

/** Generator settings for one level. Same input always gives the same output (FR-17). */
export function levelParams(difficulty: number, level: number): GenParams {
  const spec = DIFFICULTIES[difficulty];
  const start = START_SIDE[difficulty];
  if (!spec || start === undefined) {
    throw new RangeError(`unknown difficulty ${difficulty}`);
  }
  if (!Number.isInteger(level) || level < 1 || level > LEVELS_PER_DIFFICULTY) {
    throw new RangeError(
      `level ${level} is outside 1 to ${LEVELS_PER_DIFFICULTY}`,
    );
  }
  const range = ARROW_RANGE[difficulty];
  if (range === undefined)
    throw new RangeError(`unknown difficulty ${difficulty}`);
  const t = progressOf(level);
  const side = start + Math.round(lerp(0, SIDE_GROWTH, t));
  return {
    width: side,
    height: side,
    layers: spec.layers,
    arrows: Math.round(lerp(range[0], range[1], t)),
    minLength: 2,
    maxLength: Math.round(lerp(5, 8, t)),
    bendChance: lerp(0.2, 0.5, t),
    seed: seedFor(difficulty, level),
  };
}

export const buildLevel = (difficulty: number, level: number): Level =>
  generateLevel(levelParams(difficulty, level));
