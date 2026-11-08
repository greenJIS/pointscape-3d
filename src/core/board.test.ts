import { describe, expect, it } from 'vitest';
import {
  blockerOf,
  exitRay,
  freeArrowIds,
  occupancy,
  validateLevel,
} from './board';
import { hint, isSolvable, solve } from './solver';
import type { Arrow, Level } from './types';
import { RIGHT, UP, v3 } from './vec';

const arrow = (id: number, cells: [number, number][], dir = RIGHT): Arrow => ({
  id,
  cells: cells.map(([x, y]) => v3(x, y, 0)),
  dir,
});

const level = (arrows: Arrow[], width = 5, height = 5): Level => ({
  width,
  height,
  layers: 1,
  arrows,
});

describe('exit ray', () => {
  it('runs from past the head to the board edge', () => {
    const a = arrow(0, [
      [0, 0],
      [1, 0],
    ]);
    expect(exitRay(level([a]), a)).toEqual([
      v3(2, 0, 0),
      v3(3, 0, 0),
      v3(4, 0, 0),
    ]);
  });

  it('is empty when the head is on the edge', () => {
    const a = arrow(0, [
      [3, 0],
      [4, 0],
    ]);
    expect(exitRay(level([a]), a)).toEqual([]);
  });
});

describe('free and blocked', () => {
  const a = arrow(0, [
    [0, 0],
    [1, 0],
  ]);
  const b = arrow(
    1,
    [
      [3, 1],
      [3, 0],
    ],
    UP,
  );

  it('an arrow with a clear ray is free', () => {
    expect(freeArrowIds(level([a]), [a])).toEqual([0]);
  });

  it('names the arrow that blocks the ray', () => {
    const l = level([a, b]);
    expect(blockerOf(l, a, occupancy(l.arrows))).toBe(1);
  });

  it('frees an arrow once its blocker leaves', () => {
    expect(freeArrowIds(level([a, b]), [a, b])).toEqual([1]);
    expect(freeArrowIds(level([a]), [a])).toEqual([0]);
  });
});

describe('solver', () => {
  const a = arrow(0, [
    [0, 0],
    [1, 0],
  ]);
  const b = arrow(
    1,
    [
      [3, 1],
      [3, 0],
    ],
    UP,
  );

  it('returns a removal order for a solvable level', () => {
    expect(solve(level([a, b]))).toEqual([1, 0]);
  });

  it('detects two arrows that point at each other', () => {
    const p = arrow(0, [
      [0, 0],
      [1, 0],
    ]);
    const q = arrow(
      1,
      [
        [4, 0],
        [3, 0],
      ],
      v3(-1, 0, 0),
    );
    expect(isSolvable(level([p, q]))).toBe(false);
    expect(solve(level([p, q]))).toBeNull();
  });

  it('hints a free arrow, or nothing when stuck', () => {
    expect(hint(level([a, b]))).toBe(1);
    const p = arrow(0, [
      [0, 0],
      [1, 0],
    ]);
    const q = arrow(
      1,
      [
        [4, 0],
        [3, 0],
      ],
      v3(-1, 0, 0),
    );
    expect(hint(level([p, q]))).toBeUndefined();
  });
});

describe('validateLevel', () => {
  it('accepts a good level', () => {
    expect(
      validateLevel(
        level([
          arrow(0, [
            [0, 0],
            [1, 0],
          ]),
        ]),
      ),
    ).toEqual([]);
  });

  it('rejects overlap, gaps, bounds and self-blocking', () => {
    const l = level([
      arrow(0, [
        [0, 0],
        [1, 0],
      ]),
      arrow(
        1,
        [
          [1, 0],
          [1, 1],
        ],
        UP,
      ),
      arrow(2, [
        [0, 2],
        [2, 2],
      ]),
      arrow(3, [
        [4, 4],
        [5, 4],
      ]),
      arrow(
        4,
        [
          [2, 4],
          [2, 3],
        ],
        v3(0, 1, 0),
      ),
    ]);
    const problems = validateLevel(l).join('|');
    expect(problems).toContain('overlaps');
    expect(problems).toContain('gap');
    expect(problems).toContain('out of bounds');
    expect(problems).toContain('blocks itself');
  });
});
