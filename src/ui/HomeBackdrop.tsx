import { useEffect, useMemo, useState } from 'react';
import { generateLevel } from '../core/generator';
import { solve } from '../core/solver';
import type { Arrow, Level } from '../core/types';
import { Board3D } from '../view/Board3D';
import { webglAvailable, type LayerView } from '../view/BoardScene';

/** A wide board, thinned out so the text on top stays readable. */
function backdropLevel(): Level {
  const full = generateLevel({
    width: 22,
    height: 13,
    layers: 1,
    arrows: 60,
    minLength: 3,
    maxLength: 9,
    longBias: 0.7,
    tangle: 0.3,
    crossChance: 0,
    bendChance: 0.4,
    seed: 4242,
  });
  const kept = full.arrows.filter((a) => a.id % 3 !== 0);
  return { ...full, arrows: kept };
}

const LAYER_VIEW: LayerView = {
  gap: 0.3,
  hideFront: 0,
  xray: false,
  showLayers: false,
  showDots: true,
};

/** Seconds before the first tap, between taps, and after the last arrow has gone. */
const START = 1;
const STEP = 0.55;
const END = 3.4;

interface Props {
  readonly dark: boolean;
  readonly lowPower: boolean;
  /** Called once the backdrop has drawn, or at once where there is no 3D to draw. */
  readonly onReady?: () => void;
}

/**
 * The real 3D board behind Home and the name screen. It plays itself: arrows leave in a
 * solving order with the game's own slide, then they come back and it repeats.
 */
export function HomeBackdrop({ dark, lowPower, onReady }: Props) {
  const [gl] = useState(webglAvailable);
  const level = useMemo(() => backdropLevel(), []);
  const order = useMemo(() => solve(level) ?? [], [level]);
  const [gone, setGone] = useState(0);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!gl || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    let timer = 0;
    const next = (n: number): void => {
      setGone(n);
      const delay =
        n === 0 ? START * 1000 : n >= order.length ? END * 1000 : STEP * 1000;
      timer = window.setTimeout(
        () => next(n >= order.length ? 0 : n + 1),
        delay,
      );
    };
    next(0);
    return () => window.clearTimeout(timer);
  }, [gl, order]);

  const alive = useMemo(() => new Set(order.slice(gone)), [order, gone]);
  const leaving = useMemo(() => {
    const out = new Map<number, Arrow>();
    for (const id of order.slice(0, gone)) {
      const arrow = level.arrows.find((a) => a.id === id);
      if (arrow) out.set(id, arrow);
    }
    return out;
  }, [level, order, gone]);

  useEffect(() => {
    if (!gl) onReady?.();
  }, [gl, onReady]);

  if (!gl) return null;
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ${shown ? 'opacity-90' : 'opacity-0'}`}
    >
      <Board3D
        level={level}
        alive={alive}
        oneColor={null}
        flashId={null}
        hintId={null}
        leaving={leaving}
        lowPower={lowPower}
        dark={dark}
        backdrop
        slideRate={1}
        layerView={LAYER_VIEW}
        tide={gone >= order.length}
        resetCount={0}
        onTap={() => undefined}
        onReady={() => {
          setShown(true);
          onReady?.();
        }}
        onViewChange={() => undefined}
      />
    </div>
  );
}
