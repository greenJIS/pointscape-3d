export interface Difficulty {
  readonly id: 'tiny' | 'compact' | 'large' | 'vast' | 'massive';
  readonly name: string;
}

/**
 * The grid size of a level: Tiny 8x8 up to Massive 32x32 (see `SIDE` in levels.ts). It does
 * not set the number of layers, which comes from `LAYER_COUNTS`.
 */
export const DIFFICULTIES: readonly Difficulty[] = [
  { id: 'tiny', name: 'Tiny' },
  { id: 'compact', name: 'Compact' },
  { id: 'large', name: 'Large' },
  { id: 'vast', name: 'Vast' },
  { id: 'massive', name: 'Massive' },
];

/** The number of stacked layers, 1L to 5L. Independent of difficulty. */
export const LAYER_COUNTS: readonly number[] = [1, 2, 3, 4, 5];

/** Levels in each (difficulty, layers) pair. */
export const LEVELS_PER_TRACK = 100;

/** Levels of one track that must be cleared to open the tracks that follow it. */
export const UNLOCK_AFTER = 10;

/** Number of (difficulty, layers) pairs. */
export const TRACK_COUNT = DIFFICULTIES.length * LAYER_COUNTS.length;

/** Position of a (difficulty, layers) pair in lists that hold one entry per pair. */
export const trackIndex = (difficulty: number, layers: number): number =>
  difficulty * LAYER_COUNTS.length + (layers - 1);

export const isTrack = (difficulty: number, layers: number): boolean =>
  Number.isInteger(difficulty) &&
  difficulty >= 0 &&
  difficulty < DIFFICULTIES.length &&
  Number.isInteger(layers) &&
  layers >= 1 &&
  layers <= LAYER_COUNTS.length;

/** Short label for a track, for example "Compact 2L". */
export const trackName = (difficulty: number, layers: number): string =>
  `${DIFFICULTIES[difficulty]?.name ?? '?'} ${layers}L`;
