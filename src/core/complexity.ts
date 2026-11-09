import { exitRay, occupancy } from './board';
import type { Level } from './types';

export interface Complexity {
  /** The longest "this must leave before that" chain. A free-for-all board is 0. */
  readonly depth: number;
  /** Mean chain length over all arrows. */
  readonly meanDepth: number;
  /** Share of arrows that are blocked at the start, 0 to 1. */
  readonly blocked: number;
  /** Arrows whose body runs through more than one layer. */
  readonly crossing: number;
}

/**
 * How tangled a level is, independent of how many arrows it has. Arrow A waits on every arrow
 * that sits anywhere on A's exit ray, so the waiting graph is acyclic on a solvable level.
 */
export function complexityOf(level: Level): Complexity {
  const occupied = occupancy(level.arrows);
  const waitsOn = new Map<number, Set<number>>();
  for (const arrow of level.arrows) {
    const set = new Set<number>();
    for (const c of exitRay(level, arrow)) {
      const id = occupied.get(`${c.x},${c.y},${c.z}`);
      if (id !== undefined) set.add(id);
    }
    waitsOn.set(arrow.id, set);
  }
  const memo = new Map<number, number>();
  const depthOf = (id: number): number => {
    const known = memo.get(id);
    if (known !== undefined) return known;
    memo.set(id, 0);
    let d = 0;
    for (const other of waitsOn.get(id) ?? [])
      d = Math.max(d, 1 + depthOf(other));
    memo.set(id, d);
    return d;
  };
  let max = 0;
  let sum = 0;
  let blocked = 0;
  let crossing = 0;
  for (const arrow of level.arrows) {
    const d = depthOf(arrow.id);
    max = Math.max(max, d);
    sum += d;
    if ((waitsOn.get(arrow.id)?.size ?? 0) > 0) blocked++;
    if (new Set(arrow.cells.map((c) => c.z)).size > 1) crossing++;
  }
  const n = Math.max(1, level.arrows.length);
  return { depth: max, meanDepth: sum / n, blocked: blocked / n, crossing };
}
