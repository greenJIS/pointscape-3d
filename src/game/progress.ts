import {
  DIFFICULTIES,
  LEVELS_PER_DIFFICULTY,
  UNLOCK_AFTER,
} from '../core/difficulty';

export const STARTING_HINTS = 3;
/** One hint is gifted for every this many first-time clears (FR-30). */
export const HINT_GIFT_EVERY = 5;

export interface Progress {
  /** Cleared level numbers per difficulty, sorted, no duplicates. */
  readonly cleared: readonly (readonly number[])[];
  readonly hints: number;
  readonly seenTutorial: boolean;
  /** The level the player should see next on Home. */
  readonly last: { readonly difficulty: number; readonly level: number };
}

export const emptyProgress = (): Progress => ({
  cleared: DIFFICULTIES.map(() => []),
  hints: STARTING_HINTS,
  seenTutorial: false,
  last: { difficulty: 0, level: 1 },
});

export const clearedCount = (p: Progress, difficulty: number): number =>
  p.cleared[difficulty]?.length ?? 0;

export const totalCleared = (p: Progress): number =>
  p.cleared.reduce((n, list) => n + list.length, 0);

export const isCleared = (
  p: Progress,
  difficulty: number,
  level: number,
): boolean => p.cleared[difficulty]?.includes(level) ?? false;

/**
 * The only place that decides what is playable (FR-28). `unlockAll` is the
 * developer switch (FR-25). Nothing is stored for it, so it never leaks into
 * real progress (FR-27).
 */
export function isUnlocked(
  difficulty: number,
  level: number,
  p: Progress,
  unlockAll: boolean,
): boolean {
  if (difficulty < 0 || difficulty >= DIFFICULTIES.length) return false;
  if (level < 1 || level > LEVELS_PER_DIFFICULTY) return false;
  if (unlockAll) return true;
  if (!isDifficultyUnlocked(difficulty, p, false)) return false;
  return (
    level === 1 ||
    isCleared(p, difficulty, level - 1) ||
    isCleared(p, difficulty, level)
  );
}

export function isDifficultyUnlocked(
  difficulty: number,
  p: Progress,
  unlockAll: boolean,
): boolean {
  if (difficulty < 0 || difficulty >= DIFFICULTIES.length) return false;
  if (unlockAll || difficulty === 0) return true;
  return clearedCount(p, difficulty - 1) >= UNLOCK_AFTER;
}

/** First level of a difficulty that has not been cleared, or 1 when all are. */
export function nextLevel(p: Progress, difficulty: number): number {
  for (let l = 1; l <= LEVELS_PER_DIFFICULTY; l++) {
    if (!isCleared(p, difficulty, l)) return l;
  }
  return 1;
}

export interface ClearResult {
  readonly progress: Progress;
  /** False when the level was already cleared. A replay changes nothing. */
  readonly firstClear: boolean;
  readonly hintGifted: boolean;
  /** The difficulty this clear just opened, if any. */
  readonly unlocked: number | undefined;
}

export function recordClear(
  p: Progress,
  difficulty: number,
  level: number,
): ClearResult {
  if (isCleared(p, difficulty, level)) {
    return {
      progress: { ...p, last: nextAfter(difficulty, level) },
      firstClear: false,
      hintGifted: false,
      unlocked: undefined,
    };
  }
  const before = clearedCount(p, difficulty);
  const cleared = p.cleared.map((list, i) =>
    i === difficulty ? [...list, level].sort((a, b) => a - b) : list,
  );
  const next: Progress = { ...p, cleared };
  const gift = totalCleared(next) % HINT_GIFT_EVERY === 0;
  const opens =
    before < UNLOCK_AFTER &&
    clearedCount(next, difficulty) >= UNLOCK_AFTER &&
    difficulty + 1 < DIFFICULTIES.length;
  return {
    progress: {
      ...next,
      hints: next.hints + (gift ? 1 : 0),
      last: nextAfter(difficulty, level),
    },
    firstClear: true,
    hintGifted: gift,
    unlocked: opens ? difficulty + 1 : undefined,
  };
}

function nextAfter(
  difficulty: number,
  level: number,
): { difficulty: number; level: number } {
  return {
    difficulty,
    level: level < LEVELS_PER_DIFFICULTY ? level + 1 : level,
  };
}

/** Spends a hint. Returns null when none are left. */
export function spendHint(p: Progress): Progress | null {
  return p.hints > 0 ? { ...p, hints: p.hints - 1 } : null;
}

/** The first-level coach mark has been dismissed (it shows once). */
export const markTutorialSeen = (p: Progress): Progress =>
  p.seenTutorial ? p : { ...p, seenTutorial: true };
