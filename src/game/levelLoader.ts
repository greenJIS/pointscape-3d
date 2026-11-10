import { buildLevel } from '../core/levels';
import type { Level } from '../core/types';
import type { LevelReply, LevelRequest } from './levelWorker';

const cache = new Map<string, Promise<Level>>();
const waiting = new Map<number, (board: Level | null) => void>();
let worker: Worker | null | undefined;
let nextId = 1;

const keyOf = (d: number, l: number, n: number): string => `${d}:${l}:${n}`;

/** One shared worker, or null where workers are missing or fail to start. */
function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  worker = null;
  if (typeof Worker === 'undefined') return worker;
  try {
    const w = new Worker(new URL('./levelWorker.ts', import.meta.url), {
      type: 'module',
    });
    w.onmessage = (e: MessageEvent<LevelReply>) => {
      const done = waiting.get(e.data.id);
      waiting.delete(e.data.id);
      done?.(e.data.board);
    };
    w.onerror = () => {
      // Give every waiting caller the main-thread fallback, and stop using the worker.
      worker = null;
      w.terminate();
      for (const done of waiting.values()) done(null);
      waiting.clear();
    };
    worker = w;
  } catch {
    worker = null;
  }
  return worker;
}

/** Without a worker, let the page paint first, then build on the main thread. */
const buildLater = (d: number, l: number, n: number): Promise<Level> =>
  new Promise((resolve) => {
    setTimeout(() => resolve(buildLevel(d, l, n)), 0);
  });

function build(d: number, l: number, n: number): Promise<Level> {
  const w = getWorker();
  if (!w) return buildLater(d, l, n);
  return new Promise((resolve) => {
    const id = nextId++;
    waiting.set(id, (board) => resolve(board ?? buildLevel(d, l, n)));
    const req: LevelRequest = { id, difficulty: d, layers: l, level: n };
    w.postMessage(req);
  });
}

/**
 * The level, built once. Levels are seeded, so a retry or a revisit gets the cached copy.
 * Resolves on a later turn, so the caller can show a loading screen first.
 */
export function loadLevel(d: number, l: number, n: number): Promise<Level> {
  const key = keyOf(d, l, n);
  let found = cache.get(key);
  if (!found) {
    found = build(d, l, n);
    cache.set(key, found);
  }
  return found;
}

/** Start building a level that is likely to be asked for next. */
export function prefetchLevel(d: number, l: number, n: number): void {
  void loadLevel(d, l, n);
}

/** Drop every cached level. Used by tests. */
export function clearLevelCache(): void {
  cache.clear();
}
