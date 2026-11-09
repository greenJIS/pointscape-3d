import { describe, expect, it } from 'vitest';
import {
  DIFFICULTIES,
  LAYER_COUNTS,
  LEVELS_PER_TRACK,
  TRACK_COUNT,
  trackIndex,
  trackName,
} from './difficulty';

describe('difficulty and layers', () => {
  it('has five difficulties and five layer counts, starting at 1', () => {
    expect(DIFFICULTIES).toHaveLength(5);
    expect(LAYER_COUNTS).toEqual([1, 2, 3, 4, 5]);
  });

  it('has 100 levels per track and 25 tracks', () => {
    expect(LEVELS_PER_TRACK).toBe(100);
    expect(TRACK_COUNT).toBe(25);
  });

  it('gives every track its own index', () => {
    const seen = new Set<number>();
    for (let d = 0; d < DIFFICULTIES.length; d++) {
      for (const l of LAYER_COUNTS) seen.add(trackIndex(d, l));
    }
    expect(seen.size).toBe(TRACK_COUNT);
    expect(Math.max(...seen)).toBe(TRACK_COUNT - 1);
  });

  it('names a track', () => {
    expect(trackName(1, 2)).toBe('Compact 2L');
  });
});
