import { exitRay } from '../core/board';
import type { Arrow, Level, Vec3 } from '../core/types';
import { add, v3 } from '../core/vec';

/** An arrow's body extended straight past its head, so it can slide out like a snake. */
export interface ArrowPath {
  /** Cell centres tail to head, then one far point beyond the board edge. */
  readonly points: readonly Vec3[];
  /** Distance along the path to each point. */
  readonly cum: readonly number[];
  /** Length of the arrow body, in cells. */
  readonly bodyLength: number;
  /** Cells the head travels before it leaves the board. */
  readonly exitCells: number;
  /** Travel distance at which the whole body is off the board. */
  readonly finish: number;
}

const dist = (a: Vec3, b: Vec3): number =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export function arrowPath(level: Level, arrow: Arrow): ArrowPath {
  const head = arrow.cells[arrow.cells.length - 1];
  if (!head) throw new Error(`arrow ${arrow.id} has no cells`);
  const exitCells = exitRay(level, arrow).length + 1;
  const bodyLength = arrow.cells.length - 1;
  const reach = exitCells + bodyLength + 2;
  const far = add(
    head,
    v3(arrow.dir.x * reach, arrow.dir.y * reach, arrow.dir.z * reach),
  );
  const points = [...arrow.cells, far];
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b) continue;
    cum.push((cum[i - 1] ?? 0) + dist(a, b));
  }
  return {
    points,
    cum,
    bodyLength,
    exitCells,
    finish: bodyLength + exitCells,
  };
}

/** The part of the path between two distances. Clamped to the path ends. */
export function subPath(path: ArrowPath, from: number, to: number): Vec3[] {
  const total = path.cum[path.cum.length - 1] ?? 0;
  const s0 = Math.max(0, Math.min(total, from));
  const s1 = Math.max(0, Math.min(total, to));
  const at = (s: number): Vec3 => {
    let i = 0;
    while (i < path.cum.length - 2 && (path.cum[i + 1] ?? 0) < s) i++;
    const a = path.points[i];
    const b = path.points[i + 1];
    if (!a || !b) throw new Error('path has fewer than two points');
    const span = (path.cum[i + 1] ?? 0) - (path.cum[i] ?? 0);
    const t = span === 0 ? 0 : (s - (path.cum[i] ?? 0)) / span;
    return v3(
      a.x + (b.x - a.x) * t,
      a.y + (b.y - a.y) * t,
      a.z + (b.z - a.z) * t,
    );
  };
  const out = [at(s0)];
  path.points.forEach((p, i) => {
    const c = path.cum[i] ?? 0;
    if (c > s0 + 1e-6 && c < s1 - 1e-6) out.push(p);
  });
  out.push(at(s1));
  return out;
}

/**
 * Animation timing, copied from the design demo. Kept in one table so it is easy to tune.
 * Times are in seconds, lengths in cells.
 */
export const ANIM = {
  /** Exit slide: start speed (cells per second) and acceleration (cells per second squared). */
  speed: 8,
  acc: 40,
  /** Bounce: seconds going forward, then coming back. */
  forward: 0.12,
  back: 0.12,
  /** Blocker jiggle: one sine hump, this long and this far. */
  jiggle: 0.22,
  jiggleSize: 0.1,
  /** Blocked flash: fully red, then fading back to the arrow colour. */
  flashFull: 0.25,
  flashFade: 0.35,
  /** Hint: one pulse toward white with a wider head. */
  hintTime: 0.9,
  hintWhite: 0.55,
  hintHead: 0.4,
  /** Hold this long to preview an arrow's path (FR-54). */
  hold: 0.35,
  /** Intro draw-in: each arrow takes `introDraw`, starts `introStep` after the one before. */
  introDraw: 0.45,
  introStep: 0.012,
  /** The whole intro never spreads over more than this, so big boards start quickly. */
  introMaxSpread: 1.2,
  /** Win ripple over the grid dots: seconds per dot, delay per cell of distance, per layer. */
  rippleTime: 0.55,
  rippleDelay: 0.035,
  rippleLayerDelay: 0.15,
  /** Pause after the last arrow is gone before the win card, and before the lose card. */
  winCard: 0.9,
  loseCard: 0.65,
  /** Grid dots fade back in over this long once an arrow has passed (FR-52). */
  dotFade: 0.2,
  /** A moving arrow hides dots closer than this to its body. */
  dotNear: 0.42,
} as const;

/** Distance travelled after `t` seconds of an exit slide. */
export const slideDistance = (t: number, rate = 1): number => {
  const s = t * rate;
  return ANIM.speed * s + 0.5 * ANIM.acc * s * s;
};

/**
 * How far a blocked arrow nudges forward before it bounces back: it ends 0.2 cells into
 * the gap in front of the blocker, which sits `blockerCells` cells beyond the head.
 */
export const bumpDistance = (blockerCells: number): number =>
  blockerCells - 0.8;
