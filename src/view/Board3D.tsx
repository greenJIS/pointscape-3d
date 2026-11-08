import { useEffect, useRef } from 'react';
import type { Arrow, Level, Vec3 } from '../core/types';
import { BoardScene, type LayerView } from './BoardScene';

interface Props {
  readonly level: Level;
  readonly alive: ReadonlySet<number>;
  readonly oneColor: string | null;
  readonly flashId: number | null;
  readonly hintId: number | null;
  readonly leaving: ReadonlyMap<number, Arrow>;
  readonly lowPower: boolean;
  readonly layerView: LayerView;
  /** Set when the level is won: the cell the clear ripple starts from. */
  readonly rippleFrom: Vec3 | null;
  readonly onTap: (arrowId: number) => void;
}

/**
 * The three.js board. Create it with a `key` that includes the level and the
 * low-power flag, so a new scene is built when either changes.
 */
export function Board3D({
  level,
  alive,
  oneColor,
  flashId,
  hintId,
  leaving,
  lowPower,
  layerView,
  rippleFrom,
  onTap,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<BoardScene | null>(null);
  const tapRef = useRef(onTap);
  const seenLeaving = useRef(new Set<number>());

  useEffect(() => {
    tapRef.current = onTap;
  }, [onTap]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scene = new BoardScene(canvas, level, {
      lowPower,
      onTap: (id) => tapRef.current(id),
    });
    sceneRef.current = scene;
    const ro = new ResizeObserver(() => scene.resize());
    ro.observe(canvas);
    return () => {
      ro.disconnect();
      scene.dispose();
      sceneRef.current = null;
    };
  }, [level, lowPower]);

  useEffect(() => sceneRef.current?.setOneColor(oneColor), [oneColor]);
  useEffect(() => sceneRef.current?.setAlive(alive), [alive]);
  useEffect(() => sceneRef.current?.setLayerView(layerView), [layerView]);
  useEffect(() => sceneRef.current?.setHint(hintId), [hintId]);

  useEffect(() => {
    if (rippleFrom) sceneRef.current?.ripple(rippleFrom);
  }, [rippleFrom]);

  useEffect(() => {
    if (flashId !== null) sceneRef.current?.bump(flashId);
  }, [flashId]);

  useEffect(() => {
    for (const id of leaving.keys()) {
      if (!seenLeaving.current.has(id)) {
        seenLeaving.current.add(id);
        sceneRef.current?.exit(id);
      }
    }
    // A restart brings arrows back, so they may leave again later.
    for (const id of [...seenLeaving.current]) {
      if (alive.has(id)) seenLeaving.current.delete(id);
    }
  }, [leaving, alive]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="Game board"
      className="aspect-square w-full touch-none rounded-2xl bg-slate-900"
    />
  );
}
