import { blockerOf, occupancy } from './board';
import type { Level } from './types';

/**
 * Removing an arrow only ever frees other arrows, never blocks one. So taking any
 * free arrow at each step clears the level exactly when the level is solvable.
 * Returns the removal order, or null when the board gets stuck.
 */
export function solve(level: Level): number[] | null {
  const remaining = new Map(level.arrows.map((a) => [a.id, a]));
  const order: number[] = [];
  while (remaining.size > 0) {
    const occupied = occupancy([...remaining.values()]);
    const next = [...remaining.values()].find(
      (a) => blockerOf(level, a, occupied) === undefined,
    );
    if (!next) return null;
    remaining.delete(next.id);
    order.push(next.id);
  }
  return order;
}

export const isSolvable = (level: Level): boolean => solve(level) !== null;

/** One free arrow to highlight, or undefined when the board is empty or stuck (FR-21). */
export function hint(level: Level): number | undefined {
  const occupied = occupancy(level.arrows);
  return level.arrows.find((a) => blockerOf(level, a, occupied) === undefined)
    ?.id;
}
