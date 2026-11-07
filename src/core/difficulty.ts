export interface Difficulty {
  readonly id: 'easy' | 'medium' | 'hard' | 'extreme' | 'insane';
  readonly name: string;
  readonly layers: number;
}

/** Difficulty is the number of stacked layers (FR-11). */
export const DIFFICULTIES: readonly Difficulty[] = [
  { id: 'easy', name: 'Easy', layers: 1 },
  { id: 'medium', name: 'Medium', layers: 2 },
  { id: 'hard', name: 'Hard', layers: 3 },
  { id: 'extreme', name: 'Extreme', layers: 4 },
  { id: 'insane', name: 'Insane', layers: 5 },
];

export const LEVELS_PER_DIFFICULTY = 100;

/** Levels of one difficulty that must be cleared to open the next. */
export const UNLOCK_AFTER = 10;
