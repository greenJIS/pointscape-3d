import { beforeEach, describe, expect, it } from 'vitest';
import { buildLevel } from '../core/levels';
import { clearLevelCache, loadLevel } from './levelLoader';

describe('loadLevel', () => {
  beforeEach(clearLevelCache);

  it('gives the same level as buildLevel', async () => {
    expect(await loadLevel(0, 1, 3)).toEqual(buildLevel(0, 1, 3));
  });

  it('builds a level once and hands back the cached copy', async () => {
    const a = loadLevel(0, 1, 4);
    const b = loadLevel(0, 1, 4);
    expect(a).toBe(b);
    expect(await a).toBe(await b);
  });

  it('does not block the caller: the promise is still pending right after the call', async () => {
    let settled = false;
    const p = loadLevel(0, 1, 5).then(() => {
      settled = true;
    });
    expect(settled).toBe(false);
    await p;
    expect(settled).toBe(true);
  });
});
