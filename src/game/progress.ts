import {
  DIFFICULTIES,
  isTrack,
  LAYER_COUNTS,
  LEVELS_PER_TRACK,
  TRACK_COUNT,
  trackIndex,
  UNLOCK_AFTER,
} from '../core/difficulty';

export const STARTING_HINTS = 3;
/** One hint is gifted for every this many first-time clears (FR-30). */
export const HINT_GIFT_EVERY = 5;

/** One (difficulty, layers) pair, for example Compact 2L. */
export interface Track {
  readonly difficulty: number;
  readonly layers: number;
}

export interface Progress {
  /** Cleared level numbers per track (see `trackIndex`), sorted, no duplicates. */
  readonly cleared: readonly (readonly number[])[];
  readonly hints: number;
  readonly seenTutorial: boolean;
  /** The level the player should see next on Home. */
  readonly last: Track & { readonly level: number };
}

export const emptyProgress = (): Progress => ({
  cleared: Array.from({ length: TRACK_COUNT }, () => []),
  hints: STARTING_HINTS,
  seenTutorial: false,
  last: { difficulty: 0, layers: 1, level: 1 },
});

export const clearedCount = (
  p: Progress,
  difficulty: number,
  layers: number,
): number => p.cleared[trackIndex(difficulty, layers)]?.length ?? 0;

export const totalCleared = (p: Progress): number =>
  p.cleared.reduce((n, list) => n + list.length, 0);

export const isCleared = (
  p: Progress,
  difficulty: number,
  layers: number,
  level: number,
): boolean =>
  p.cleared[trackIndex(difficulty, layers)]?.includes(level) ?? false;

/**
 * The track that must be cleared (UNLOCK_AFTER levels) to open this one, or null for the
 * first. A track opens from the one with fewer layers in its row. The 1L track of a row opens
 * from the difficulty above it. So Tiny 1L opens both Compact 1L and Tiny 2L, while Tiny 2L
 * opens only Tiny 3L.
 */
export function prerequisite(difficulty: number, layers: number): Track | null {
  if (layers > 1) return { difficulty, layers: layers - 1 };
  if (difficulty > 0) return { difficulty: difficulty - 1, layers: 1 };
  return null;
}

/** The tracks that clearing this one opens. */
export function opens(difficulty: number, layers: number): Track[] {
  const out: Track[] = [];
  if (layers < LAYER_COUNTS.length)
    out.push({ difficulty, layers: layers + 1 });
  if (layers === 1 && difficulty + 1 < DIFFICULTIES.length) {
    out.push({ difficulty: difficulty + 1, layers: 1 });
  }
  return out;
}

/**
 * The only place that decides what is playable (FR-28). `unlockAll` is the
 * developer switch (FR-25). Nothing is stored for it, so it never leaks into
 * real progress (FR-27).
 */
export function isUnlocked(
  difficulty: number,
  layers: number,
  level: number,
  p: Progress,
  unlockAll: boolean,
): boolean {
  if (!isTrack(difficulty, layers)) return false;
  if (level < 1 || level > LEVELS_PER_TRACK) return false;
  if (unlockAll) return true;
  if (!isTrackUnlocked(difficulty, layers, p, false)) return false;
  return (
    level === 1 ||
    isCleared(p, difficulty, layers, level - 1) ||
    isCleared(p, difficulty, layers, level)
  );
}

export function isTrackUnlocked(
  difficulty: number,
  layers: number,
  p: Progress,
  unlockAll: boolean,
): boolean {
  if (!isTrack(difficulty, layers)) return false;
  if (unlockAll) return true;
  const need = prerequisite(difficulty, layers);
  if (!need) return true;
  return clearedCount(p, need.difficulty, need.layers) >= UNLOCK_AFTER;
}

/** First level of a track that has not been cleared, or 1 when all are. */
export function nextLevel(
  p: Progress,
  difficulty: number,
  layers: number,
): number {
  for (let l = 1; l <= LEVELS_PER_TRACK; l++) {
    if (!isCleared(p, difficulty, layers, l)) return l;
  }
  return 1;
}

export interface ClearResult {
  readonly progress: Progress;
  /** False when the level was already cleared. A replay changes nothing. */
  readonly firstClear: boolean;
  readonly hintGifted: boolean;
  /** The tracks this clear just opened. Empty most of the time. */
  readonly unlocked: readonly Track[];
}

export function recordClear(
  p: Progress,
  difficulty: number,
  layers: number,
  level: number,
): ClearResult {
  if (isCleared(p, difficulty, layers, level)) {
    return {
      progress: { ...p, last: nextAfter(difficulty, layers, level) },
      firstClear: false,
      hintGifted: false,
      unlocked: [],
    };
  }
  const index = trackIndex(difficulty, layers);
  const before = clearedCount(p, difficulty, layers);
  const cleared = p.cleared.map((list, i) =>
    i === index ? [...list, level].sort((a, b) => a - b) : list,
  );
  const next: Progress = { ...p, cleared };
  const gift = totalCleared(next) % HINT_GIFT_EVERY === 0;
  const crossed =
    before < UNLOCK_AFTER &&
    clearedCount(next, difficulty, layers) >= UNLOCK_AFTER;
  return {
    progress: {
      ...next,
      hints: next.hints + (gift ? 1 : 0),
      last: nextAfter(difficulty, layers, level),
    },
    firstClear: true,
    hintGifted: gift,
    unlocked: crossed ? opens(difficulty, layers) : [],
  };
}

function nextAfter(
  difficulty: number,
  layers: number,
  level: number,
): Track & { level: number } {
  return {
    difficulty,
    layers,
    level: level < LEVELS_PER_TRACK ? level + 1 : level,
  };
}

/** Spends a hint. Returns null when none are left. */
export function spendHint(p: Progress): Progress | null {
  return p.hints > 0 ? { ...p, hints: p.hints - 1 } : null;
}

/** The first-level coach mark has been dismissed (it shows once). */
export const markTutorialSeen = (p: Progress): Progress =>
  p.seenTutorial ? p : { ...p, seenTutorial: true };
