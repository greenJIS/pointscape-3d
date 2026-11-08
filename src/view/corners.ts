import type { Vec3 } from '../core/types';
import { v3 } from '../core/vec';

const EPS = 1e-4;

const sub = (a: Vec3, b: Vec3): Vec3 => v3(a.x - b.x, a.y - b.y, a.z - b.z);
const len = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 =>
  v3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);

/** Drops points that sit on top of the previous one. */
export function dedupe(points: readonly Vec3[]): Vec3[] {
  const out: Vec3[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || len(sub(p, last)) > EPS) out.push(p);
  }
  return out;
}

/**
 * Replaces each sharp corner by a short curve of `segments` steps, so a bent
 * arrow looks like a bent tube. Straight runs lose their middle points.
 */
export function roundCorners(
  input: readonly Vec3[],
  radius: number,
  segments = 6,
): Vec3[] {
  const pts = dedupe(input);
  if (pts.length < 3) return pts;
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (!first || !last) return pts;
  const out: Vec3[] = [first];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const c = pts[i + 1];
    if (!a || !b || !c) continue;
    const inLen = len(sub(b, a));
    const outLen = len(sub(c, b));
    const din = v3(
      (b.x - a.x) / inLen,
      (b.y - a.y) / inLen,
      (b.z - a.z) / inLen,
    );
    const dout = v3(
      (c.x - b.x) / outLen,
      (c.y - b.y) / outLen,
      (c.z - b.z) / outLen,
    );
    const straight =
      Math.abs(din.x - dout.x) < EPS &&
      Math.abs(din.y - dout.y) < EPS &&
      Math.abs(din.z - dout.z) < EPS;
    if (straight) continue;
    const r = Math.min(radius, inLen / 2, outLen / 2);
    const start = v3(b.x - din.x * r, b.y - din.y * r, b.z - din.z * r);
    const end = v3(b.x + dout.x * r, b.y + dout.y * r, b.z + dout.z * r);
    for (let s = 0; s <= segments; s++) {
      const t = s / segments;
      // Quadratic curve with the corner as its control point.
      out.push(lerp3(lerp3(start, b, t), lerp3(b, end, t), t));
    }
  }
  out.push(last);
  return dedupe(out);
}
