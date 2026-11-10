import { buildLevel } from '../core/levels';
import type { Level } from '../core/types';

export interface LevelRequest {
  readonly id: number;
  readonly difficulty: number;
  readonly layers: number;
  readonly level: number;
}

export interface LevelReply {
  readonly id: number;
  readonly board: Level | null;
}

/** Builds levels off the main thread, so a big board does not freeze the page. */
self.onmessage = (e: MessageEvent<LevelRequest>) => {
  const { id, difficulty, layers, level } = e.data;
  const build = (): Level | null => {
    try {
      return buildLevel(difficulty, layers, level);
    } catch {
      return null;
    }
  };
  const board = build();
  const reply: LevelReply = { id, board };
  self.postMessage(reply);
};
