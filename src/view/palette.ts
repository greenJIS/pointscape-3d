import { assignColors } from '../core/coloring';
import type { Level } from '../core/types';

/** The five arrow colours (FR-31). Same values as the `@theme` tokens in index.css. */
export const POOL: readonly string[] = [
  '#ff8a00',
  '#ffe600',
  '#00f5d0',
  '#5b6bff',
  '#ff2bd6',
];

export const BLOCKED = '#ff4d5e';

/** Colour per arrow id with touching arrows kept apart where the pool allows (FR-36). */
export const arrowColors = (level: Level): Map<number, string> => {
  const seed = level.width * 131 + level.layers * 17 + level.arrows.length;
  const picked = assignColors(level, POOL.length, seed);
  const result = new Map<number, string>();
  for (const [id, i] of picked) result.set(id, POOL[i] ?? '#ffffff');
  return result;
};
