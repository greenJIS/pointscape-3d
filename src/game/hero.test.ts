import { describe, expect, it } from 'vitest';
import { validateLevel } from '../core/board';
import { solve } from '../core/solver';
import { HERO_LEVEL } from './hero';

describe('hero board', () => {
  it('is well formed and every arrow can leave in some order', () => {
    expect(validateLevel(HERO_LEVEL)).toEqual([]);
    expect(solve(HERO_LEVEL)).toHaveLength(HERO_LEVEL.arrows.length);
  });
});
