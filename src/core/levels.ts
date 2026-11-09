import { isTrack, LEVELS_PER_TRACK, trackIndex } from './difficulty';
import type { GenParams } from './generator';
import { generateLevel } from './generator';
import type { Level } from './types';

/**
 * Board side for each difficulty: Tiny 8, Compact 12, Large 18, Vast 24, Massive 32 (owner).
 * The side is the same for every layer count and every level of that difficulty.
 */
const SIDE = [8, 12, 18, 24, 32] as const;

/**
 * How full the board is at level 1 and at level 100 of each difficulty: arrows per cell. The
 * generator stops when no arrow fits, which happens at a lower fill on a bigger grid, so the
 * ends stay under that point and the count rises with the level number instead of wobbling
 * with the random fill. Tune by playtest.
 */
const DENSITY = [
  [0.12, 0.19],
  [0.09, 0.13],
  [0.08, 0.115],
  [0.06, 0.085],
  [0.045, 0.065],
] as const;
/** The longest arrow never passes this, so a path stays readable on the biggest grid. */
const MAX_LENGTH = 30;
/** The generator slows down on huge boards, so the arrow count stops here. */
const MAX_ARROWS = 700;

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Position of a level inside its track, 0 at level 1 and 1 at the last level. */
const progressOf = (level: number): number =>
  (level - 1) / (LEVELS_PER_TRACK - 1);

export function seedFor(
  difficulty: number,
  layers: number,
  level: number,
): number {
  return 1000 + trackIndex(difficulty, layers) * 5000 + level * 37;
}

/** Generator settings for one level. Same input always gives the same output (FR-17). */
export function levelParams(
  difficulty: number,
  layers: number,
  level: number,
): GenParams {
  if (!isTrack(difficulty, layers)) {
    throw new RangeError(`unknown track ${difficulty}, ${layers}L`);
  }
  if (!Number.isInteger(level) || level < 1 || level > LEVELS_PER_TRACK) {
    throw new RangeError(`level ${level} is outside 1 to ${LEVELS_PER_TRACK}`);
  }
  const side = SIDE[difficulty];
  const density = DENSITY[difficulty];
  if (side === undefined || density === undefined) {
    throw new RangeError(`unknown track ${difficulty}, ${layers}L`);
  }
  const t = progressOf(level);
  const cells = side * side * layers;
  return {
    width: side,
    height: side,
    layers,
    arrows: Math.min(
      MAX_ARROWS,
      Math.round(cells * lerp(density[0], density[1], t)),
    ),
    minLength: 2,
    // Long snaking lines are the heart of the game: the cap grows toward the grid side.
    maxLength: Math.min(MAX_LENGTH, Math.round(side * lerp(0.5, 1, t))),
    longBias: lerp(0.6, 1, t),
    // Chains and layer crossings are what make a late level harder than an early one.
    tangle: lerp(0, 1, t),
    crossChance: layers > 1 ? lerp(0.1, 0.45, t) : 0,
    bendChance: lerp(0.2, 0.5, t),
    seed: seedFor(difficulty, layers, level),
  };
}

export const buildLevel = (
  difficulty: number,
  layers: number,
  level: number,
): Level => generateLevel(levelParams(difficulty, layers, level));
