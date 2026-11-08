import { exitRay, inBounds } from './board';
import { createRng, type Rng } from './rng';
import type { Arrow, Level, Vec3 } from './types';
import { add, DIRS_ALL, DIRS_PLANAR, key, neg, v3 } from './vec';

export interface GenParams {
  readonly width: number;
  readonly height: number;
  readonly layers: number;
  /** How many arrows to try to place. The result may hold fewer on a crowded board. */
  readonly arrows: number;
  /** Arrow length in cells, tail to head, inclusive. */
  readonly minLength: number;
  readonly maxLength: number;
  /** Chance that the body turns at each step while growing back from the head. */
  readonly bendChance: number;
  readonly seed: number;
}

/** Candidates scored per placed arrow. More candidates give denser blocking. */
const CANDIDATES = 12;
const MAX_MISSES = 400;

/**
 * Reverse construction (FR-18). Arrows are placed one after another, and each new
 * arrow's exit ray must be clear of every arrow placed before it. Removing the
 * arrows in reverse placement order therefore always clears the board (FR-16).
 */
export function generateLevel(params: GenParams): Level {
  const rng = createRng(params.seed);
  const dirs = params.layers > 1 ? DIRS_ALL : DIRS_PLANAR;
  const shape = {
    width: params.width,
    height: params.height,
    layers: params.layers,
  };
  const taken = new Set<string>();
  const placed: Arrow[] = [];
  let misses = 0;

  while (placed.length < params.arrows && misses < MAX_MISSES) {
    let best: { arrow: Arrow; score: number } | undefined;
    for (let i = 0; i < CANDIDATES; i++) {
      const cand = candidate(params, dirs, taken, placed.length, rng);
      if (!cand) continue;
      const ray = exitRay(shape, cand);
      const own = new Set(cand.cells.map(key));
      if (ray.some((c) => taken.has(key(c)) || own.has(key(c)))) continue;
      // Long rays leave more room for later arrows to sit in front of this one.
      const score = ray.length + bends(cand) * 2 + rng.next();
      if (!best || score > best.score) best = { arrow: cand, score };
    }
    if (!best) {
      misses++;
      continue;
    }
    placed.push(best.arrow);
    for (const c of best.arrow.cells) taken.add(key(c));
  }
  return { ...shape, arrows: placed };
}

/** Grow an arrow backward from a random head cell. */
function candidate(
  p: GenParams,
  dirs: readonly Vec3[],
  taken: ReadonlySet<string>,
  id: number,
  rng: Rng,
): Arrow | undefined {
  const head = v3(rng.int(p.width), rng.int(p.height), rng.int(p.layers));
  if (taken.has(key(head))) return undefined;
  const dir = rng.pick(dirs);
  const length =
    p.minLength + rng.int(Math.max(1, p.maxLength - p.minLength + 1));
  const level = { width: p.width, height: p.height, layers: p.layers };
  const used = new Set([key(head)]);
  const back: Vec3[] = [head];
  let heading: Vec3 | undefined;

  for (let i = 1; i < length; i++) {
    const at = back[back.length - 1];
    if (!at) return undefined;
    let step: Vec3;
    if (heading === undefined) {
      // First step back: straight behind the head, or any in-plane step if the head points along z.
      step = dir.z === 0 ? neg(dir) : rng.pick(DIRS_PLANAR);
    } else if (rng.chance(p.bendChance)) {
      const h = heading;
      const turns = DIRS_PLANAR.filter(
        (d) => (d.x !== h.x || d.y !== h.y) && !isOpposite(d, h),
      );
      step = rng.pick(turns);
    } else {
      step = heading;
    }
    const next = add(at, step);
    if (!inBounds(level, next) || taken.has(key(next)) || used.has(key(next))) {
      if (i >= p.minLength) break;
      return undefined;
    }
    used.add(key(next));
    back.push(next);
    heading = step;
  }
  if (back.length < Math.max(2, p.minLength)) return undefined;
  return { id, cells: back.reverse(), dir };
}

const isOpposite = (a: Vec3, b: Vec3): boolean =>
  a.x === -b.x && a.y === -b.y && a.z === -b.z;

function bends(arrow: Arrow): number {
  let count = 0;
  for (let i = 2; i < arrow.cells.length; i++) {
    const a = arrow.cells[i - 2];
    const b = arrow.cells[i - 1];
    const c = arrow.cells[i];
    if (!a || !b || !c) continue;
    if (b.x - a.x !== c.x - b.x || b.y - a.y !== c.y - b.y) count++;
  }
  return count;
}
