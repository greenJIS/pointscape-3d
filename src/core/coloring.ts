import type { Level } from './types';
import { createRng } from './rng';
import { key } from './vec';

const STEPS: readonly (readonly [number, number, number])[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

/** Arrow ids that touch each arrow: a cell sits next to a cell of another arrow (FR-36). */
export function neighbours(level: Level): Map<number, Set<number>> {
  const owner = new Map<string, number>();
  for (const a of level.arrows)
    for (const c of a.cells) owner.set(key(c), a.id);
  const result = new Map<number, Set<number>>();
  for (const a of level.arrows) {
    const near = new Set<number>();
    for (const c of a.cells) {
      for (const [dx, dy, dz] of STEPS) {
        const other = owner.get(key({ x: c.x + dx, y: c.y + dy, z: c.z + dz }));
        if (other !== undefined && other !== a.id) near.add(other);
      }
    }
    result.set(a.id, near);
  }
  return result;
}

/**
 * Colour index per arrow, 0 to `colors - 1`. Greedy: each arrow takes the colour its
 * touching arrows use least, ties broken by a seeded generator. Best effort when the
 * pool is too small, and the same every time for a given level and seed (FR-36).
 */
export function assignColors(
  level: Level,
  colors: number,
  seed: number,
): Map<number, number> {
  const rng = createRng(seed);
  const near = neighbours(level);
  const result = new Map<number, number>();
  for (const a of level.arrows) {
    const counts = new Array<number>(colors).fill(0);
    for (const n of near.get(a.id) ?? []) {
      const c = result.get(n);
      if (c !== undefined) counts[c] = (counts[c] ?? 0) + 1;
    }
    const best = Math.min(...counts);
    const options = counts.flatMap((n, i) => (n === best ? [i] : []));
    result.set(a.id, rng.pick(options));
  }
  return result;
}
