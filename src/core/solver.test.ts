import { describe, expect, it } from 'vitest';
import { hint, isSolvable, solve } from './solver';
import type { Arrow, Level } from './types';

const right = { x: 1, y: 0, z: 0 };
const arrow = (id: number, y: number, x1: number, x2: number): Arrow => ({
  id,
  cells: Array.from({ length: x2 - x1 + 1 }, (_, i) => ({
    x: x1 + i,
    y,
    z: 0,
  })),
  dir: right,
});
const level = (arrows: Arrow[]): Level => ({
  width: 6,
  height: 3,
  layers: 1,
  arrows,
});

describe('solve', () => {
  it('clears an empty board with no moves', () => {
    expect(solve(level([]))).toEqual([]);
  });

  it('puts a blocker after the arrow that blocks it', () => {
    // Arrow 1 points right along row 0 and runs into arrow 2's tail.
    const l = level([arrow(1, 0, 0, 1), arrow(2, 0, 3, 4)]);
    const order = solve(l);
    expect(order).toEqual([2, 1]);
  });

  it('returns null when two arrows block each other', () => {
    const left = { x: -1, y: 0, z: 0 };
    const a: Arrow = {
      id: 1,
      cells: [
        { x: 1, y: 0, z: 0 },
        { x: 2, y: 0, z: 0 },
      ],
      dir: right,
    };
    const b: Arrow = {
      id: 2,
      cells: [
        { x: 4, y: 0, z: 0 },
        { x: 3, y: 0, z: 0 },
      ],
      dir: left,
    };
    const l = level([a, b]);
    expect(solve(l)).toBeNull();
    expect(isSolvable(l)).toBe(false);
  });
});

describe('hint', () => {
  it('names a free arrow', () => {
    const l = level([arrow(1, 0, 0, 1), arrow(2, 0, 3, 4)]);
    expect(hint(l)).toBe(2);
  });

  it('gives nothing for an empty or stuck board', () => {
    expect(hint(level([]))).toBeUndefined();
  });
});
