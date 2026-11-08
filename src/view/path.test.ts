import { describe, expect, it } from 'vitest';
import type { Arrow, Level } from '../core/types';
import { RIGHT, UP, v3 } from '../core/vec';
import { ANIM, arrowPath, bumpDistance, slideDistance, subPath } from './path';

const level: Level = { width: 6, height: 6, layers: 1, arrows: [] };
const straight: Arrow = {
  id: 0,
  cells: [v3(1, 2, 0), v3(2, 2, 0), v3(3, 2, 0)],
  dir: RIGHT,
};
const bent: Arrow = {
  id: 1,
  cells: [v3(1, 4, 0), v3(2, 4, 0), v3(2, 3, 0)],
  dir: UP,
};

const length = (
  pts: readonly { x: number; y: number; z: number }[],
): number => {
  let sum = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (a && b) sum += Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  }
  return sum;
};

describe('arrowPath', () => {
  it('counts the cells the head travels to leave the board', () => {
    // Head at x=3 on a 6 wide board: cells 4 and 5 are free, then it is out.
    expect(arrowPath(level, straight).exitCells).toBe(3);
  });

  it('is finished when the whole body is off the board', () => {
    const p = arrowPath(level, straight);
    expect(p.finish).toBe(p.bodyLength + p.exitCells);
  });

  it('runs past the head in the head direction', () => {
    const p = arrowPath(level, straight);
    const far = p.points[p.points.length - 1];
    expect(far?.y).toBe(2);
    expect(far?.x).toBeGreaterThan(6);
  });
});

describe('subPath', () => {
  const path = arrowPath(level, bent);

  it('has the requested length', () => {
    expect(length(subPath(path, 0, 2))).toBeCloseTo(2);
    expect(length(subPath(path, 1.5, 3.5))).toBeCloseTo(2);
  });

  it('keeps the corner of a bent arrow in view', () => {
    const pts = subPath(path, 0, 2);
    expect(pts.some((p) => p.x === 2 && p.y === 4)).toBe(true);
  });

  it('slides along the head direction once past the tail', () => {
    const pts = subPath(path, 3, 5);
    expect(pts.every((p) => p.x === 2)).toBe(true);
    expect(pts[0]?.y).toBeGreaterThan(pts[pts.length - 1]?.y ?? 0);
  });

  it('clamps to the path ends', () => {
    const total = path.cum[path.cum.length - 1] ?? 0;
    const pts = subPath(path, total - 1, total + 50);
    expect(length(pts)).toBeCloseTo(1);
  });
});

describe('timing', () => {
  it('starts at rest distance zero and speeds up', () => {
    expect(slideDistance(0)).toBe(0);
    const early = slideDistance(0.1) - slideDistance(0);
    const late = slideDistance(0.6) - slideDistance(0.5);
    expect(late).toBeGreaterThan(early);
  });

  it('bump stops short of the blocker but always moves a little', () => {
    expect(bumpDistance(1)).toBeCloseTo(0.2);
    expect(bumpDistance(4)).toBeCloseTo(3.2);
  });

  it('keeps the bounce timings in the table', () => {
    expect(ANIM.forward).toBeGreaterThan(0);
    expect(ANIM.back).toBeGreaterThan(0);
  });
});
