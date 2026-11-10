import { blockerOf, occupancy } from '../core/board';
import { hint } from '../core/solver';
import type { Arrow, Level } from '../core/types';

/** The default number of lives, for a session that is not told how many. */
export const STARTING_LIVES = 3;

/** Lives at 1L and at 5L for each difficulty. Layers in between are spread evenly. */
const LIVES: readonly (readonly [number, number])[] = [
  [3, 5],
  [4, 6],
  [5, 7],
  [6, 7],
  [7, 7],
];

/** Lives a level starts with. Harder tracks give more. */
export function livesFor(difficulty: number, layers: number): number {
  const [low, high] = LIVES[difficulty] ?? [STARTING_LIVES, STARTING_LIVES];
  const t = (Math.min(5, Math.max(1, layers)) - 1) / 4;
  return Math.round(low + (high - low) * t);
}

export type Status = 'playing' | 'won' | 'lost';

/** One attempt at one level. Pure data: every change returns a new session. */
export interface Session {
  readonly level: Level;
  /** Ids of arrows still on the board. */
  readonly alive: ReadonlySet<number>;
  readonly lives: number;
  /** Lives at the start, so the screen can show the lost ones. */
  readonly maxLives: number;
  /** Arrows that already cost a life, so a repeat tap is free (FR-6). */
  readonly penalised: ReadonlySet<number>;
  readonly status: Status;
}

export type TapOutcome = 'exit' | 'blocked' | 'ignored';

export interface TapResult {
  readonly session: Session;
  readonly outcome: TapOutcome;
  /** The arrow in the way, when the tap was blocked. */
  readonly blockerId?: number;
  readonly lifeLost: boolean;
}

export const startSession = (
  level: Level,
  maxLives: number = STARTING_LIVES,
): Session => ({
  level,
  alive: new Set(level.arrows.map((a) => a.id)),
  lives: maxLives,
  maxLives,
  penalised: new Set(),
  status: 'playing',
});

export const arrowsLeft = (s: Session): readonly Arrow[] =>
  s.level.arrows.filter((a) => s.alive.has(a.id));

/** The level with only the arrows still on the board. */
const remainingLevel = (s: Session): Level => ({
  ...s.level,
  arrows: arrowsLeft(s),
});

/** Tapping an arrow (FR-5, FR-6, FR-7, FR-8). */
export function tap(s: Session, arrowId: number): TapResult {
  const arrow = s.level.arrows.find((a) => a.id === arrowId);
  if (s.status !== 'playing' || !arrow || !s.alive.has(arrowId)) {
    return { session: s, outcome: 'ignored', lifeLost: false };
  }
  const rest = arrowsLeft(s);
  const blocker = blockerOf(s.level, arrow, occupancy(rest));

  if (blocker === undefined) {
    const alive = new Set(s.alive);
    alive.delete(arrowId);
    return {
      session: { ...s, alive, status: alive.size === 0 ? 'won' : 'playing' },
      outcome: 'exit',
      lifeLost: false,
    };
  }

  if (s.penalised.has(arrowId)) {
    return {
      session: s,
      outcome: 'blocked',
      blockerId: blocker,
      lifeLost: false,
    };
  }
  const lives = s.lives - 1;
  return {
    session: {
      ...s,
      lives,
      penalised: new Set(s.penalised).add(arrowId),
      status: lives <= 0 ? 'lost' : 'playing',
    },
    outcome: 'blocked',
    blockerId: blocker,
    lifeLost: true,
  };
}

/** One free arrow to highlight, or undefined when the level is over (FR-21). */
export const hintFor = (s: Session): number | undefined =>
  s.status === 'playing' ? hint(remainingLevel(s)) : undefined;

/** Same level, fresh lives and arrows. Levels are seeded, so it is the same board (FR-17). */
export const restart = (s: Session): Session =>
  startSession(s.level, s.maxLives);
