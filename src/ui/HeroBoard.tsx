import { useEffect, useState } from 'react';
import { solve } from '../core/solver';
import type { Arrow } from '../core/types';
import { HERO_LEVEL } from '../game/hero';
import { FlatBoard } from '../view/FlatBoard';

const ORDER = solve(HERO_LEVEL) ?? [];
const STEP_MS = 900;
const PAUSE_STEPS = 2;

/** The Home board. Arrows leave one by one, then the board refills and repeats. */
export function HeroBoard() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduce.matches) return;
    const id = window.setInterval(
      () => setStep((s) => (s + 1) % (ORDER.length + PAUSE_STEPS + 1)),
      STEP_MS,
    );
    return () => window.clearInterval(id);
  }, []);

  const gone = new Set(ORDER.slice(0, step));
  // The arrow that left on this step stays drawn, fading out, until the next step.
  const out = HERO_LEVEL.arrows.find((a) => a.id === ORDER[step - 1]);
  const leaving: ReadonlyMap<number, Arrow> = new Map(
    out ? [[out.id, out]] : [],
  );
  const alive = new Set(
    HERO_LEVEL.arrows.map((a) => a.id).filter((id) => !gone.has(id)),
  );

  return (
    <div aria-hidden="true" className="pointer-events-none w-64 sm:w-72">
      <FlatBoard
        level={HERO_LEVEL}
        alive={alive}
        oneColor={null}
        flashId={null}
        hintId={null}
        leaving={leaving}
        onTap={() => undefined}
      />
    </div>
  );
}
