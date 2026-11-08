import { describe, expect, it } from 'vitest';
import type { Level } from '../core/types';
import { LEFT, RIGHT, UP, v3 } from '../core/vec';
import {
  arrowsLeft,
  hintFor,
  restart,
  startSession,
  STARTING_LIVES,
  tap,
} from './session';

// Arrow 0 points right and is blocked by arrow 1. Arrow 1 points up and is free.
// Arrow 2 points left, is free, and sits away from the others.
const level: Level = {
  width: 6,
  height: 6,
  layers: 1,
  arrows: [
    { id: 0, cells: [v3(0, 0, 0), v3(1, 0, 0)], dir: RIGHT },
    { id: 1, cells: [v3(3, 1, 0), v3(3, 0, 0)], dir: UP },
    { id: 2, cells: [v3(3, 5, 0), v3(2, 5, 0)], dir: LEFT },
  ],
};

describe('tap', () => {
  it('removes a free arrow without costing a life (FR-5)', () => {
    const r = tap(startSession(level), 1);
    expect(r.outcome).toBe('exit');
    expect(r.session.alive.has(1)).toBe(false);
    expect(r.session.lives).toBe(STARTING_LIVES);
  });

  it('keeps a blocked arrow and costs one life, naming the blocker (FR-6)', () => {
    const r = tap(startSession(level), 0);
    expect(r.outcome).toBe('blocked');
    expect(r.blockerId).toBe(1);
    expect(r.lifeLost).toBe(true);
    expect(r.session.lives).toBe(STARTING_LIVES - 1);
    expect(r.session.alive.has(0)).toBe(true);
  });

  it('costs a life only once per arrow', () => {
    const once = tap(startSession(level), 0).session;
    const twice = tap(once, 0);
    expect(twice.outcome).toBe('blocked');
    expect(twice.lifeLost).toBe(false);
    expect(twice.session.lives).toBe(STARTING_LIVES - 1);
  });

  it('frees an arrow once its blocker is gone', () => {
    const s = tap(startSession(level), 1).session;
    expect(tap(s, 0).outcome).toBe('exit');
  });

  it('ignores taps on removed or unknown arrows', () => {
    const s = tap(startSession(level), 1).session;
    expect(tap(s, 1).outcome).toBe('ignored');
    expect(tap(s, 99).outcome).toBe('ignored');
  });

  it('does not change the session it was given', () => {
    const s = startSession(level);
    tap(s, 1);
    tap(s, 0);
    expect(s).toEqual(startSession(level));
  });
});

describe('winning and losing', () => {
  it('wins when the last arrow leaves (FR-8)', () => {
    let s = startSession(level);
    for (const id of [1, 0, 2]) s = tap(s, id).session;
    expect(s.status).toBe('won');
    expect(arrowsLeft(s)).toHaveLength(0);
  });

  it('loses at zero lives (FR-7)', () => {
    // Three arrows, all blocked, so each tap costs a life.
    const jam: Level = {
      width: 6,
      height: 6,
      layers: 1,
      arrows: [
        { id: 0, cells: [v3(0, 0, 0), v3(1, 0, 0)], dir: RIGHT },
        { id: 1, cells: [v3(0, 1, 0), v3(1, 1, 0)], dir: RIGHT },
        { id: 2, cells: [v3(0, 2, 0), v3(1, 2, 0)], dir: RIGHT },
        { id: 3, cells: [v3(4, 0, 0), v3(4, 1, 0), v3(4, 2, 0)], dir: UP },
        { id: 4, cells: [v3(3, 0, 0), v3(3, 1, 0), v3(3, 2, 0)], dir: UP },
      ],
    };
    let s = startSession(jam);
    for (const id of [0, 1, 2]) s = tap(s, id).session;
    expect(s.lives).toBe(0);
    expect(s.status).toBe('lost');
    expect(tap(s, 3).outcome).toBe('ignored');
  });
});

describe('hint and restart', () => {
  it('hints a free arrow, and nothing once the level is over', () => {
    expect(hintFor(startSession(level))).toBe(1);
    let s = startSession(level);
    for (const id of [1, 0, 2]) s = tap(s, id).session;
    expect(hintFor(s)).toBeUndefined();
  });

  it('restart brings back every arrow and every life', () => {
    let s = startSession(level);
    s = tap(tap(s, 0).session, 1).session;
    expect(restart(s)).toEqual(startSession(level));
  });
});
