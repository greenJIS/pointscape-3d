import type { Arrow, Level, Vec3 } from './types';
import { add, key } from './vec';

export const inBounds = (
  level: Pick<Level, 'width' | 'height' | 'layers'>,
  c: Vec3,
): boolean =>
  c.x >= 0 &&
  c.y >= 0 &&
  c.z >= 0 &&
  c.x < level.width &&
  c.y < level.height &&
  c.z < level.layers;

export const headOf = (arrow: Arrow): Vec3 => {
  const head = arrow.cells[arrow.cells.length - 1];
  if (head === undefined) throw new Error(`arrow ${arrow.id} has no cells`);
  return head;
};

/** Cells from just past the head to the board edge (FR-4). */
export function exitRay(
  level: Pick<Level, 'width' | 'height' | 'layers'>,
  arrow: Arrow,
): Vec3[] {
  const ray: Vec3[] = [];
  let c = add(headOf(arrow), arrow.dir);
  while (inBounds(level, c)) {
    ray.push(c);
    c = add(c, arrow.dir);
  }
  return ray;
}

/** Map from cell key to the id of the arrow that fills it. */
export function occupancy(arrows: readonly Arrow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const arrow of arrows) {
    for (const c of arrow.cells) map.set(key(c), arrow.id);
  }
  return map;
}

/** The id of the first arrow on the exit ray, or undefined if the arrow is free. */
export function blockerOf(
  level: Pick<Level, 'width' | 'height' | 'layers'>,
  arrow: Arrow,
  occupied: ReadonlyMap<string, number>,
): number | undefined {
  for (const c of exitRay(level, arrow)) {
    const id = occupied.get(key(c));
    if (id !== undefined) return id;
  }
  return undefined;
}

export const isFree = (
  level: Pick<Level, 'width' | 'height' | 'layers'>,
  arrow: Arrow,
  occupied: ReadonlyMap<string, number>,
): boolean => blockerOf(level, arrow, occupied) === undefined;

/** Ids of every arrow that can leave right now. */
export function freeArrowIds(
  level: Pick<Level, 'width' | 'height' | 'layers'>,
  arrows: readonly Arrow[],
): number[] {
  const occupied = occupancy(arrows);
  return arrows.filter((a) => isFree(level, a, occupied)).map((a) => a.id);
}

/** Checks that a level is well formed: cells in bounds, no overlap, neighbours touch. */
export function validateLevel(level: Level): string[] {
  const problems: string[] = [];
  const seen = new Map<string, number>();
  for (const arrow of level.arrows) {
    if (arrow.cells.length < 2) problems.push(`arrow ${arrow.id} too short`);
    arrow.cells.forEach((c, i) => {
      if (!inBounds(level, c)) problems.push(`arrow ${arrow.id} out of bounds`);
      const other = seen.get(key(c));
      if (other !== undefined) {
        problems.push(`arrow ${arrow.id} overlaps arrow ${other}`);
      }
      seen.set(key(c), arrow.id);
      const prev = arrow.cells[i - 1];
      if (prev !== undefined) {
        const d =
          Math.abs(c.x - prev.x) +
          Math.abs(c.y - prev.y) +
          Math.abs(c.z - prev.z);
        if (d !== 1) problems.push(`arrow ${arrow.id} has a gap`);
      }
    });
    // An arrow whose own body sits on its exit ray could never leave.
    const own = new Set(arrow.cells.map(key));
    if (exitRay(level, arrow).some((c) => own.has(key(c)))) {
      problems.push(`arrow ${arrow.id} blocks itself`);
    }
  }
  return problems;
}
