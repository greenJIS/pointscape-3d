import { useEffect, useState, type ReactNode } from 'react';
import { LEVELS_PER_TRACK, trackName } from '../core/difficulty';
import type { Level } from '../core/types';
import { loadLevel, prefetchLevel } from '../game/levelLoader';
import { Loading } from './Loading';

interface Props {
  readonly difficulty: number;
  readonly layers: number;
  readonly level: number;
  readonly children: (board: Level) => ReactNode;
}

/**
 * Builds the level off the main thread, with a loading screen up meanwhile, and then
 * gets the next level ready in the background so Next is quick.
 */
export function LevelGate({ difficulty, layers, level, children }: Props) {
  const [board, setBoard] = useState<Level | null>(null);

  useEffect(() => {
    let live = true;
    void loadLevel(difficulty, layers, level).then((b) => {
      if (live) setBoard(b);
    });
    return () => {
      live = false;
    };
  }, [difficulty, layers, level]);

  useEffect(() => {
    if (!board || level >= LEVELS_PER_TRACK) return;
    // Wait for the board to draw first, so the two builds do not compete.
    const id = window.setTimeout(
      () => prefetchLevel(difficulty, layers, level + 1),
      1500,
    );
    return () => window.clearTimeout(id);
  }, [board, difficulty, layers, level]);

  if (!board) {
    return (
      <Loading
        label="Building level"
        detail={`${trackName(difficulty, layers)} · Level ${level}`}
      />
    );
  }
  return <>{children(board)}</>;
}
