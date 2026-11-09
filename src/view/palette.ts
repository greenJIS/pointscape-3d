import { assignColors } from '../core/coloring';
import type { Level } from '../core/types';

/** The five arrow colours (FR-31). Same values as the `@theme` tokens in index.css. */
export const POOL: readonly string[] = [
  '#fb923c',
  '#facc15',
  '#2dd4bf',
  '#818cf8',
  '#e879f9',
];

export const BLOCKED = '#f87171';

/** Colour per arrow id with touching arrows kept apart where the pool allows (FR-36). */
export const arrowColors = (level: Level): Map<number, string> => {
  const seed = level.width * 131 + level.layers * 17 + level.arrows.length;
  const picked = assignColors(level, POOL.length, seed);
  const result = new Map<number, string>();
  for (const [id, i] of picked) result.set(id, POOL[i] ?? '#ffffff');
  return result;
};
