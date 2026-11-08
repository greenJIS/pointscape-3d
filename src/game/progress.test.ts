import { describe, expect, it } from 'vitest';
import { UNLOCK_AFTER } from '../core/difficulty';
import {
  clearedCount,
  emptyProgress,
  isDifficultyUnlocked,
  isUnlocked,
  nextLevel,
  recordClear,
  spendHint,
  type Progress,
} from './progress';

function clearMany(p: Progress, difficulty: number, n: number): Progress {
  let cur = p;
  for (let l = 1; l <= n; l++) cur = recordClear(cur, difficulty, l).progress;
  return cur;
}

describe('isUnlocked', () => {
  const fresh = emptyProgress();

  it('opens only Easy level 1 at the start (FR-22, FR-24)', () => {
    expect(isUnlocked(0, 1, fresh, false)).toBe(true);
    expect(isUnlocked(0, 2, fresh, false)).toBe(false);
    expect(isUnlocked(1, 1, fresh, false)).toBe(false);
  });

  it('opens level n+1 when level n is cleared', () => {
    const p = recordClear(fresh, 0, 1).progress;
    expect(isUnlocked(0, 2, p, false)).toBe(true);
    expect(isUnlocked(0, 3, p, false)).toBe(false);
  });

  it('opens the next difficulty after UNLOCK_AFTER clears (FR-23)', () => {
    const nine = clearMany(fresh, 0, UNLOCK_AFTER - 1);
    expect(isDifficultyUnlocked(1, nine, false)).toBe(false);
    const ten = clearMany(fresh, 0, UNLOCK_AFTER);
    expect(isDifficultyUnlocked(1, ten, false)).toBe(true);
    expect(isUnlocked(1, 1, ten, false)).toBe(true);
    expect(isUnlocked(2, 1, ten, false)).toBe(false);
  });

  it('opens everything in unlock-all mode, but never outside the game (FR-25)', () => {
    expect(isUnlocked(4, 100, fresh, true)).toBe(true);
    expect(isUnlocked(5, 1, fresh, true)).toBe(false);
    expect(isUnlocked(0, 101, fresh, true)).toBe(false);
  });

  it('does not store anything for unlock-all (FR-27)', () => {
    isUnlocked(4, 100, fresh, true);
    expect(fresh).toEqual(emptyProgress());
  });
});

describe('recordClear', () => {
  it('counts a first clear and ignores a replay', () => {
    const first = recordClear(emptyProgress(), 0, 1);
    expect(first.firstClear).toBe(true);
    const again = recordClear(first.progress, 0, 1);
    expect(again.firstClear).toBe(false);
    expect(clearedCount(again.progress, 0)).toBe(1);
    expect(again.hintGifted).toBe(false);
  });

  it('gifts one hint on every 5th first clear and not on replays (FR-30)', () => {
    let p = emptyProgress();
    const gifts: boolean[] = [];
    for (let l = 1; l <= 10; l++) {
      const r = recordClear(p, 0, l);
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
    expect(recordClear(p, 0, 5).progress.hints).toBe(5);
  });

  it('reports the difficulty a clear just opened, once', () => {
    const nine = clearMany(emptyProgress(), 0, UNLOCK_AFTER - 1);
    const r = recordClear(nine, 0, UNLOCK_AFTER);
    expect(r.unlocked).toBe(1);
    expect(
      recordClear(r.progress, 0, UNLOCK_AFTER + 1).unlocked,
    ).toBeUndefined();
  });

  it('opens nothing after the last difficulty', () => {
    const nine = clearMany(emptyProgress(), 4, UNLOCK_AFTER - 1);
    expect(recordClear(nine, 4, UNLOCK_AFTER).unlocked).toBeUndefined();
  });

  it('points Home at the following level', () => {
    expect(recordClear(emptyProgress(), 0, 4).progress.last).toEqual({
      difficulty: 0,
      level: 5,
    });
    expect(recordClear(emptyProgress(), 0, 100).progress.last.level).toBe(100);
  });

  it('does not change the progress it was given', () => {
    const p = emptyProgress();
    recordClear(p, 0, 1);
    expect(p).toEqual(emptyProgress());
  });
});

describe('nextLevel and hints', () => {
  it('finds the first level not cleared', () => {
    expect(nextLevel(emptyProgress(), 0)).toBe(1);
    expect(nextLevel(clearMany(emptyProgress(), 0, 4), 0)).toBe(5);
  });

  it('spends hints and refuses at zero', () => {
    let p: Progress | null = emptyProgress();
    for (let i = 0; i < 3; i++) p = p && spendHint(p);
    expect(p?.hints).toBe(0);
    expect(p && spendHint(p)).toBeNull();
  });
});
