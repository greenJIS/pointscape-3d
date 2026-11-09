import { exitRay, inBounds } from './board';
import { createRng, type Rng } from './rng';
import type { Arrow, Level, Vec3 } from './types';
import { add, BACK, DIRS_ALL, DIRS_PLANAR, FRONT, key, neg, v3 } from './vec';

export interface GenParams {
  readonly width: number;
  readonly height: number;
  readonly layers: number;
  /** How many arrows to try to place. The result may hold fewer on a crowded board. */
  readonly arrows: number;
  /** Arrow length in cells, tail to head, inclusive. */
  readonly minLength: number;
  readonly maxLength: number;
  /**
   * How strongly the first arrows lean to long ones, 0 to 1. The board is empty at the start, so
   * long snaking lines fit there. Later arrows fill the gaps with short ones.
   */
  readonly longBias: number;
  /**
   * How hard the build works to chain arrows into each other, 0 to 1. Higher values prefer an
   * arrow that sits in the way of arrows that are already waiting on others, which makes long
   * "this before that" chains the player has to untangle.
   */
  readonly tangle: number;
  /** Chance that a bend turns toward the viewer or away, so a line crosses layers. */
  readonly crossChance: number;
  /** Chance that the body turns at each step while growing back from the head. */
  readonly bendChance: number;
  readonly seed: number;
}

/** Candidates scored per placed arrow. More candidates give denser blocking. */
const CANDIDATES = 24;
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
  /** Arrows whose exit ray covers a cell, for scoring how much a new arrow gets in the way. */
  const rayCover = new Map<string, number[]>();
  /** blockers[i]: arrows sitting somewhere on arrow i's exit ray. */
  const blockers: Set<number>[] = [];
  /** depth[i]: arrows in the longest chain that must leave before arrow i can. */
  const depth: number[] = [];
  let misses = 0;

  while (placed.length < params.arrows && misses < MAX_MISSES) {
    let best: { arrow: Arrow; score: number; hit: Set<number> } | undefined;
    for (let i = 0; i < CANDIDATES; i++) {
      const early = 1 - placed.length / Math.max(1, params.arrows);
      const aim =
        placed.length > 0 && rng.chance(params.tangle * 0.95)
          ? aimAtStuck(
              shape,
              placed,
              depth,
              blockers,
              taken,
              rng,
              params.tangle,
            )
          : undefined;
      const cand = candidate(
        params,
        dirs,
        taken,
        placed.length,
        rng,
        early,
        aim,
      );
      if (!cand) continue;
      const ray = exitRay(shape, cand);
      const own = new Set(cand.cells.map(key));
      if (ray.some((c) => taken.has(key(c)) || own.has(key(c)))) continue;
      // Long rays leave more room for later arrows to sit in front of this one.
      const hit = new Set<number>();
      for (const c of cand.cells) {
        for (const id of rayCover.get(key(c)) ?? []) hit.add(id);
      }
      let gain = 0;
      for (const id of hit) gain += 1 + (depth[id] ?? 0);
      // Early levels lean on long free rays. Late levels lean on getting in the way of arrows
      // that are already stuck behind others.
      const score =
        (1 - params.tangle) * (ray.length * 0.5 + bends(cand) * 2) +
        params.tangle * gain * 8 +
        rng.next();
      if (!best || score > best.score) best = { arrow: cand, score, hit };
    }
    if (!best) {
      misses++;
      continue;
    }
    const id = placed.length;
    placed.push(best.arrow);
    for (const c of best.arrow.cells) taken.add(key(c));
    for (const c of exitRay(shape, best.arrow)) {
      const list = rayCover.get(key(c));
      if (list) list.push(id);
      else rayCover.set(key(c), [id]);
    }
    blockers.push(new Set());
    depth.push(0);
    for (const other of best.hit) blockers[other]?.add(id);
    // Blockers are always placed later, so one pass from the newest arrow back is enough.
    for (let i = id; i >= 0; i--) {
      let d = 0;
      for (const b of blockers[i] ?? []) d = Math.max(d, 1 + (depth[b] ?? 0));
      depth[i] = d;
    }
  }
  const arrows = fillGaps(params, dirs, taken, placed, rng).map((a, id) => ({
    ...a,
    id,
  }));
  return { ...shape, arrows };
}

/**
 * Packs the board. Cells the main build left empty are filled with more arrows, each slotted
 * into the removal order where it fits. An arrow can go anywhere after every arrow whose exit
 * ray crosses its body, and before every arrow its own exit ray runs into. Early passes grow
 * long snaking bodies that reach into pockets. Later passes shorten the target until two-cell
 * arrows plug the rest.
 */
function fillGaps(
  p: GenParams,
  dirs: readonly Vec3[],
  taken: Set<string>,
  built: readonly Arrow[],
  rng: Rng,
): Arrow[] {
  const shape = { width: p.width, height: p.height, layers: p.layers };
  /** The removal order, last placed first to leave. */
  const order: Arrow[] = [...built];
  const owner = new Map<string, Arrow>();
  const lanes = new Map<string, Arrow[]>();
  const register = (arrow: Arrow): void => {
    for (const c of arrow.cells) owner.set(key(c), arrow);
    for (const c of exitRay(shape, arrow)) {
      const list = lanes.get(key(c));
      if (list) list.push(arrow);
      else lanes.set(key(c), [arrow]);
    }
  };
  for (const arrow of built) register(arrow);
  let pos = new Map<Arrow, number>();
  const reindex = (): void => {
    pos = new Map(order.map((a, i) => [a, i]));
  };
  reindex();

  const cells: Vec3[] = [];
  for (let z = 0; z < p.layers; z++) {
    for (let y = 0; y < p.height; y++) {
      for (let x = 0; x < p.width; x++) cells.push(v3(x, y, z));
    }
  }
  const targets = [p.maxLength, Math.min(p.maxLength, 8), 4, p.minLength];
  // Easy levels first take only arrows that barely touch the others, then give in. Hard levels
  // take tangled arrows from the start.
  const caps = [1, 2, 3, 4, 6, Infinity].filter(
    (c) => c >= Math.round(1 + p.tangle * 5),
  );
  for (const target of targets) {
    for (const cap of caps) {
      for (let again = true; again;) {
        again = false;
        for (let i = cells.length - 1; i >= 0; i--) {
          const c = cells[i];
          if (c && taken.has(key(c))) cells.splice(i, 1);
        }
        shuffle(cells, rng);
        for (const head of cells) {
          if (taken.has(key(head))) continue;
          let best: Fit | undefined;
          for (const dir of dirs) {
            // The ray depends on the head alone, so check it before growing a body.
            const ray = exitRay(shape, { id: 0, cells: [head], dir });
            const ahead = new Set<Arrow>();
            for (const c of ray) {
              const o = owner.get(key(c));
              if (o) ahead.add(o);
            }
            if (ahead.size > cap) continue;
            const arrow = snake(p, taken, head, dir, target, 0, rng);
            if (!arrow) continue;
            const own = new Set(arrow.cells.map(key));
            if (ray.some((c) => own.has(key(c)))) continue;
            // Arrows whose ray crosses this body must leave after it, so they come earlier.
            const crossing = new Set<Arrow>();
            for (const c of arrow.cells) {
              for (const o of lanes.get(key(c)) ?? []) crossing.add(o);
            }
            // Arrows this ray runs into must still be there when it leaves, so they come later.
            let lo = -1;
            for (const o of crossing) lo = Math.max(lo, pos.get(o) ?? -1);
            let hi = order.length;
            for (const o of ahead) hi = Math.min(hi, pos.get(o) ?? hi);
            const links = crossing.size + ahead.size;
            if (lo >= hi || links > cap) continue;
            const score =
              arrow.cells.length * 2 +
              (p.tangle * 2 - 1) * Math.min(links, 6) * 3 +
              rng.next();
            if (!best || score > best.score) best = { arrow, score, lo, hi };
          }
          if (!best) continue;
          const at = best.lo + 1 + rng.int(best.hi - best.lo);
          order.splice(at, 0, best.arrow);
          for (const c of best.arrow.cells) taken.add(key(c));
          register(best.arrow);
          reindex();
        }
      }
    }
  }
  return order;
}

/** A filler arrow and the slots it may take in the removal order: after `lo`, up to `hi`. */
interface Fit {
  readonly arrow: Arrow;
  readonly score: number;
  readonly lo: number;
  readonly hi: number;
}

function shuffle<T>(items: T[], rng: Rng): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    const a = items[i];
    const b = items[j];
    if (a === undefined || b === undefined) continue;
    items[i] = b;
    items[j] = a;
  }
}

/**
 * Grows a body back from `head`. Each step prefers a neighbour with few free cells of its own,
 * which makes the body hug walls and fill pockets, and goes straight on half the time.
 */
function snake(
  p: GenParams,
  taken: ReadonlySet<string>,
  head: Vec3,
  dir: Vec3,
  target: number,
  id: number,
  rng: Rng,
): Arrow | undefined {
  const level = { width: p.width, height: p.height, layers: p.layers };
  const used = new Set([key(head)]);
  const back: Vec3[] = [head];
  const free = (c: Vec3): boolean =>
    inBounds(level, c) && !taken.has(key(c)) && !used.has(key(c));
  let heading: Vec3 | undefined;
  while (back.length < target) {
    const at = back[back.length - 1];
    if (!at) return undefined;
    let step: Vec3 | undefined;
    if (heading === undefined) {
      const first = dir.z === 0 ? neg(dir) : rng.pick(DIRS_PLANAR);
      if (free(add(at, first))) step = first;
    } else {
      const pool =
        p.layers > 1 && rng.chance(p.crossChance)
          ? [...DIRS_PLANAR, FRONT, BACK]
          : DIRS_PLANAR;
      const options = pool.filter(
        (d) => !isOpposite(d, heading ?? d) && free(add(at, d)),
      );
      const straight = options.find(
        (d) => d.x === heading?.x && d.y === heading?.y && d.z === heading?.z,
      );
      if (straight && rng.chance(0.5)) {
        step = straight;
      } else {
        let least = Infinity;
        for (const d of options) {
          const next = add(at, d);
          let open = 0;
          for (const e of dirs6) if (free(add(next, e))) open++;
          const rank = open + rng.next();
          if (rank < least) {
            least = rank;
            step = d;
          }
        }
      }
    }
    if (!step) break;
    const next = add(at, step);
    used.add(key(next));
    back.push(next);
    heading = step;
  }
  if (back.length < Math.max(2, p.minLength)) return undefined;
  return { id, cells: back.reverse(), dir };
}

const dirs6: readonly Vec3[] = DIRS_ALL;

/**
 * A free cell on the exit ray of an arrow that a new arrow should get in front of. Half the
 * time that is the deepest of a few random arrows, which lengthens a chain. The other half it
 * is an arrow nothing blocks yet, which keeps the share of free arrows down. The count of
 * arrows looked at grows with `tangle`.
 */
function aimAtStuck(
  shape: Pick<Level, 'width' | 'height' | 'layers'>,
  placed: readonly Arrow[],
  depth: readonly number[],
  blockers: readonly Set<number>[],
  taken: ReadonlySet<string>,
  rng: Rng,
  tangle: number,
): Vec3 | undefined {
  let pick = rng.int(placed.length);
  const looks = 1 + Math.round(tangle * 11);
  const deep = rng.chance(0.5);
  for (let i = 0; i < looks; i++) {
    const other = rng.int(placed.length);
    const better = deep
      ? (depth[other] ?? 0) > (depth[pick] ?? 0)
      : (blockers[other]?.size ?? 0) === 0 && (blockers[pick]?.size ?? 0) > 0;
    if (better) pick = other;
  }
  const target = placed[pick];
  if (!target) return undefined;
  const open = exitRay(shape, target).filter((c) => !taken.has(key(c)));
  return open.length > 0 ? rng.pick(open) : undefined;
}

/**
 * Arrow length. Early in the build, with chance `longBias * early`, it comes from the longer
 * half of the range. Otherwise it comes from the shorter half.
 */
function pickLength(p: GenParams, early: number, rng: Rng): number {
  const mid = Math.max(
    p.minLength,
    Math.floor((p.minLength + p.maxLength) / 2),
  );
  const long = rng.chance(p.longBias * early);
  const lo = long ? mid : p.minLength;
  const hi = long ? p.maxLength : mid;
  return lo + rng.int(Math.max(1, hi - lo + 1));
}

/** Grow an arrow backward from a random head cell. */
function candidate(
  p: GenParams,
  dirs: readonly Vec3[],
  taken: ReadonlySet<string>,
  id: number,
  rng: Rng,
  early: number,
  aim?: Vec3,
): Arrow | undefined {
  const head =
    aim ?? v3(rng.int(p.width), rng.int(p.height), rng.int(p.layers));
  if (taken.has(key(head))) return undefined;
  const dir = rng.pick(dirs);
  const length = pickLength(p, early, rng);
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
      const cross = p.layers > 1 && rng.chance(p.crossChance);
      const pool = cross ? Z_STEPS : DIRS_PLANAR;
      const turns = pool.filter(
        (d) =>
          !(d.x === h.x && d.y === h.y && d.z === h.z) && !isOpposite(d, h),
      );
      // Heading along z leaves no other z turn, so such a step just carries on.
      step = turns.length > 0 ? rng.pick(turns) : h;
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

/** Steps toward and away from the viewer, for lines that cross layers. */
const Z_STEPS: readonly Vec3[] = [FRONT, BACK];

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
