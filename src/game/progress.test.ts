import { describe, expect, it } from 'vitest';
import { UNLOCK_AFTER } from '../core/difficulty';
import {
  clearedCount,
  emptyProgress,
  isTrackUnlocked,
  isUnlocked,
  nextLevel,
  opens,
  prerequisite,
  recordClear,
  spendHint,
  type Progress,
  markTutorialSeen,
} from './progress';

function clearMany(
  p: Progress,
  difficulty: number,
  layers: number,
  n: number,
): Progress {
  let cur = p;
  for (let l = 1; l <= n; l++) {
    cur = recordClear(cur, difficulty, layers, l).progress;
  }
  return cur;
}

const open = (p: Progress, d: number, layers: number): boolean =>
  isTrackUnlocked(d, layers, p, false);

describe('isUnlocked', () => {
  const fresh = emptyProgress();

  it('opens only Tiny 1L level 1 at the start (FR-22, FR-24)', () => {
    expect(isUnlocked(0, 1, 1, fresh, false)).toBe(true);
    expect(isUnlocked(0, 1, 2, fresh, false)).toBe(false);
    expect(isUnlocked(1, 1, 1, fresh, false)).toBe(false);
    expect(isUnlocked(0, 2, 1, fresh, false)).toBe(false);
  });

  it('opens level n+1 when level n is cleared', () => {
    const p = recordClear(fresh, 0, 1, 1).progress;
    expect(isUnlocked(0, 1, 2, p, false)).toBe(true);
    expect(isUnlocked(0, 1, 3, p, false)).toBe(false);
  });

  it('opens both Compact 1L and Tiny 2L after 10 Tiny 1L clears (FR-23)', () => {
    const nine = clearMany(fresh, 0, 1, UNLOCK_AFTER - 1);
    expect(open(nine, 1, 1)).toBe(false);
    expect(open(nine, 0, 2)).toBe(false);
    const ten = clearMany(fresh, 0, 1, UNLOCK_AFTER);
    expect(open(ten, 1, 1)).toBe(true);
    expect(open(ten, 0, 2)).toBe(true);
    expect(isUnlocked(1, 1, 1, ten, false)).toBe(true);
    expect(isUnlocked(0, 2, 1, ten, false)).toBe(true);
    expect(open(ten, 2, 1)).toBe(false);
    expect(open(ten, 0, 3)).toBe(false);
    expect(open(ten, 1, 2)).toBe(false);
  });

  it('opens only the next size after 10 Tiny 2L clears, not Compact 2L', () => {
    const p = clearMany(
      clearMany(fresh, 0, 1, UNLOCK_AFTER),
      0,
      2,
      UNLOCK_AFTER,
    );
    expect(open(p, 0, 3)).toBe(true);
    expect(open(p, 1, 2)).toBe(false);
  });

  it('opens Compact 2L only after 10 Compact 1L clears', () => {
    const p = clearMany(
      clearMany(fresh, 0, 1, UNLOCK_AFTER),
      1,
      1,
      UNLOCK_AFTER,
    );
    expect(open(p, 1, 2)).toBe(true);
    expect(open(p, 2, 1)).toBe(true);
    expect(open(p, 2, 2)).toBe(false);
  });

  it('opens everything in unlock-all mode, but never outside the game (FR-25)', () => {
    expect(isUnlocked(4, 5, 100, fresh, true)).toBe(true);
    expect(isUnlocked(5, 1, 1, fresh, true)).toBe(false);
    expect(isUnlocked(0, 6, 1, fresh, true)).toBe(false);
    expect(isUnlocked(0, 1, 101, fresh, true)).toBe(false);
  });

  it('does not store anything for unlock-all (FR-27)', () => {
    isUnlocked(4, 5, 100, fresh, true);
    expect(fresh).toEqual(emptyProgress());
  });
});

describe('prerequisite and opens', () => {
  it('chains a row by layers and the 1L column by difficulty', () => {
    expect(prerequisite(0, 1)).toBeNull();
    expect(prerequisite(0, 2)).toEqual({ difficulty: 0, layers: 1 });
    expect(prerequisite(1, 1)).toEqual({ difficulty: 0, layers: 1 });
    expect(prerequisite(1, 2)).toEqual({ difficulty: 1, layers: 1 });
    expect(prerequisite(3, 5)).toEqual({ difficulty: 3, layers: 4 });
  });

  it('lists what a track opens', () => {
    expect(opens(0, 1)).toEqual([
      { difficulty: 0, layers: 2 },
      { difficulty: 1, layers: 1 },
    ]);
    expect(opens(0, 2)).toEqual([{ difficulty: 0, layers: 3 }]);
    expect(opens(4, 1)).toEqual([{ difficulty: 4, layers: 2 }]);
    expect(opens(4, 5)).toEqual([]);
  });
});

describe('recordClear', () => {
  it('counts a first clear and ignores a replay', () => {
    const first = recordClear(emptyProgress(), 0, 1, 1);
    expect(first.firstClear).toBe(true);
    const again = recordClear(first.progress, 0, 1, 1);
    expect(again.firstClear).toBe(false);
    expect(clearedCount(again.progress, 0, 1)).toBe(1);
    expect(again.hintGifted).toBe(false);
  });

  it('keeps each track separate', () => {
    const p = recordClear(emptyProgress(), 1, 3, 1).progress;
    expect(clearedCount(p, 1, 3)).toBe(1);
    expect(clearedCount(p, 1, 2)).toBe(0);
    expect(clearedCount(p, 3, 1)).toBe(0);
  });

  it('gifts one hint on every 5th first clear and not on replays (FR-30)', () => {
    let p = emptyProgress();
    const gifts: boolean[] = [];
    for (let l = 1; l <= 10; l++) {
      const r = recordClear(p, 0, 1, l);
      gifts.push(r.hintGifted);
      p = r.progress;
    }
    expect(gifts).toEqual([
      false,
      false,
      false,
      false,
      true,
      false,
      false,
      false,
      false,
      true,
    ]);
    expect(p.hints).toBe(5);
    expect(recordClear(p, 0, 1, 5).progress.hints).toBe(5);
  });

  it('reports the tracks a clear just opened, once', () => {
    const nine = clearMany(emptyProgress(), 0, 1, UNLOCK_AFTER - 1);
    const r = recordClear(nine, 0, 1, UNLOCK_AFTER);
    expect(r.unlocked).toEqual([
      { difficulty: 0, layers: 2 },
      { difficulty: 1, layers: 1 },
    ]);
    expect(recordClear(r.progress, 0, 1, UNLOCK_AFTER + 1).unlocked).toEqual(
      [],
    );
  });

  it('reports only the next size for a track past the 1L column', () => {
    const nine = clearMany(emptyProgress(), 2, 2, UNLOCK_AFTER - 1);
    expect(recordClear(nine, 2, 2, UNLOCK_AFTER).unlocked).toEqual([
      { difficulty: 2, layers: 3 },
    ]);
  });

  it('opens nothing after the last track', () => {
    const nine = clearMany(emptyProgress(), 4, 5, UNLOCK_AFTER - 1);
    expect(recordClear(nine, 4, 5, UNLOCK_AFTER).unlocked).toEqual([]);
  });

  it('points Home at the following level', () => {
    expect(recordClear(emptyProgress(), 0, 1, 4).progress.last).toEqual({
      difficulty: 0,
      layers: 1,
      level: 5,
    });
    expect(recordClear(emptyProgress(), 2, 3, 100).progress.last).toEqual({
      difficulty: 2,
      layers: 3,
      level: 100,
    });
  });

  it('does not change the progress it was given', () => {
    const p = emptyProgress();
    recordClear(p, 0, 1, 1);
    expect(p).toEqual(emptyProgress());
  });
});

describe('nextLevel and hints', () => {
  it('finds the first level not cleared', () => {
    expect(nextLevel(emptyProgress(), 0, 1)).toBe(1);
    expect(nextLevel(clearMany(emptyProgress(), 0, 1, 4), 0, 1)).toBe(5);
    expect(nextLevel(clearMany(emptyProgress(), 0, 1, 4), 0, 2)).toBe(1);
  });

  it('spends hints and refuses at zero', () => {
    let p: Progress | null = emptyProgress();
    for (let i = 0; i < 3; i++) p = p && spendHint(p);
    expect(p?.hints).toBe(0);
    expect(p && spendHint(p)).toBeNull();
  });
});

describe('markTutorialSeen', () => {
  it('flips the flag once and is saved with progress', () => {
    const p = markTutorialSeen(emptyProgress());
    expect(p.seenTutorial).toBe(true);
    expect(markTutorialSeen(p)).toBe(p);
  });
});
