import { createRng } from '../core/rng';
import { seedFor } from '../core/levels';

/** The five arrow colours (FR-31). Same values as the `@theme` tokens in index.css. */
export const POOL: readonly string[] = [
  '#fb923c',
  '#facc15',
  '#2dd4bf',
  '#818cf8',
  '#e879f9',
];

export const BLOCKED = '#f87171';

/** One-color mode: one pool colour per level, the same every time for that level (FR-35). */
export const oneColorFor = (difficulty: number, level: number): string =>
  createRng(seedFor(difficulty, level) ^ 0x9e3779b9).pick(POOL);

/** Placeholder colouring until neighbour colouring lands (FR-36). */
export const colorFor = (arrowId: number, oneColor: string | null): string =>
  oneColor ?? POOL[arrowId % POOL.length] ?? '#ffffff';
