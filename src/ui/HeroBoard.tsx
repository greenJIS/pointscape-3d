import { useEffect, useState } from 'react';
import { solve } from '../core/solver';
import type { Vec3 } from '../core/types';
import { HERO_LEVEL } from '../game/hero';
import { FlatBoard } from '../view/FlatBoard';
import { arrowPath, slideDistance, subPath } from '../view/path';

const ORDER = solve(HERO_LEVEL) ?? [];
const PATHS = new Map(
  HERO_LEVEL.arrows.map((a) => [a.id, arrowPath(HERO_LEVEL, a)]),
);
const NO_LEAVING = new Map();

/** Seconds before the first tap, between taps, and after the last arrow is gone. */
const START = 0.8;
const STEP = 0.9;
const END = 1.2;
const FADE_IN = 0.4;
const CYCLE = START + ORDER.length * STEP + END;

/** The Home board. Arrows slide out one by one with the game's own slide, then it repeats. */
export function HeroBoard() {
  const [clock, setClock] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduce.matches) return;
    let raf = 0;
    const tick = (now: number): void => {
      setClock((now / 1000) % CYCLE);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const alive = new Set<number>();
  const shapes = new Map<number, readonly Vec3[]>();
  ORDER.forEach((id, k) => {
    const path = PATHS.get(id);
    if (!path) return;
    const t = clock - (START + k * STEP);
    if (t <= 0) {
      alive.add(id);
      return;
    }
    const s = slideDistance(t);
    if (s >= path.finish) return;
    alive.add(id);
    shapes.set(id, subPath(path, s, s + path.bodyLength));
  });

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none w-64 sm:w-72"
      style={{ opacity: Math.min(1, clock / FADE_IN) }}
    >
      <FlatBoard
        level={HERO_LEVEL}
        alive={alive}
        oneColor={null}
        flashId={null}
        hintId={null}
        leaving={NO_LEAVING}
        shapes={shapes}
        onTap={() => undefined}
      />
    </div>
  );
}
