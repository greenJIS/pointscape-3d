import { describe, expect, it } from 'vitest';
import { v3 } from '../core/vec';
import { dedupe, roundCorners } from './corners';

describe('dedupe', () => {
  it('drops repeated points', () => {
    expect(dedupe([v3(0, 0, 0), v3(0, 0, 0), v3(1, 0, 0)])).toHaveLength(2);
  });
});

describe('roundCorners', () => {
  it('leaves a straight line as its two ends', () => {
    const out = roundCorners([v3(0, 0, 0), v3(1, 0, 0), v3(2, 0, 0)], 0.3);
    expect(out).toEqual([v3(0, 0, 0), v3(2, 0, 0)]);
  });

  it('keeps both ends of a bent line', () => {
    const pts = [v3(0, 0, 0), v3(2, 0, 0), v3(2, 2, 0)];
    const out = roundCorners(pts, 0.4);
    expect(out[0]).toEqual(v3(0, 0, 0));
    expect(out[out.length - 1]).toEqual(v3(2, 2, 0));
    expect(out.length).toBeGreaterThan(3);
  });

  it('cuts the corner instead of passing through it', () => {
    const out = roundCorners([v3(0, 0, 0), v3(2, 0, 0), v3(2, 2, 0)], 0.4);
    expect(out.some((p) => p.x === 2 && p.y === 0)).toBe(false);
  });

  it('never rounds more than half a segment', () => {
    const out = roundCorners([v3(0, 0, 0), v3(0.5, 0, 0), v3(0.5, 0.5, 0)], 5);
    for (const p of out) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(0.5 + 1e-9);
      expect(p.y).toBeLessThanOrEqual(0.5 + 1e-9);
    }
  });
});
