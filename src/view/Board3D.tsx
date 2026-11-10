import { useEffect, useRef } from 'react';
import type { Arrow, Level } from '../core/types';
import { BoardScene, type LayerView } from './BoardScene';

interface Props {
  readonly level: Level;
  readonly alive: ReadonlySet<number>;
  readonly oneColor: string | null;
  readonly flashId: number | null;
  readonly hintId: number | null;
  readonly leaving: ReadonlyMap<number, Arrow>;
  readonly lowPower: boolean;
  readonly dark: boolean;
  /** Page backdrop mode, see `SceneOptions.backdrop`. */
  readonly backdrop?: boolean;
  /** Exit slide speed, 1 being the demo's. */
  readonly slideRate: number;
  readonly layerView: LayerView;
  /** Set when the level is won: the cell the clear ripple starts from. */
  readonly tide: boolean;
  /** Each change puts the board back to its opening view. */
  readonly resetCount: number;
  readonly onTap: (arrowId: number) => void;
  /** True while the view sits at its opening position. */
  readonly onViewChange: (isDefault: boolean) => void;
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
  dark,
  backdrop = false,
  slideRate,
  layerView,
  tide,
  resetCount,
  onTap,
  onViewChange,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<BoardScene | null>(null);
  const tapRef = useRef(onTap);
  const viewRef = useRef(onViewChange);
  const darkRef = useRef(dark);
  const seenLeaving = useRef(new Set<number>());

  useEffect(() => {
    darkRef.current = dark;
    sceneRef.current?.setDark(dark);
  }, [dark]);

  useEffect(() => {
    tapRef.current = onTap;
    viewRef.current = onViewChange;
  }, [onTap, onViewChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scene = new BoardScene(canvas, level, {
      lowPower,
      dark: darkRef.current,
      backdrop,
      onTap: (id) => tapRef.current(id),
      onViewChange: (d) => viewRef.current(d),
    });
    sceneRef.current = scene;
    viewRef.current(true);
    const ro = new ResizeObserver(() => scene.resize());
    ro.observe(canvas);
    return () => {
      ro.disconnect();
      scene.dispose();
      sceneRef.current = null;
    };
  }, [level, lowPower, backdrop]);

  useEffect(() => {
    if (sceneRef.current) sceneRef.current.slideRate = slideRate;
  }, [slideRate, level, lowPower]);
  useEffect(() => sceneRef.current?.setOneColor(oneColor), [oneColor]);
  useEffect(() => sceneRef.current?.setAlive(alive), [alive]);
  useEffect(() => sceneRef.current?.setLayerView(layerView), [layerView]);
  useEffect(() => sceneRef.current?.setHint(hintId), [hintId]);

  useEffect(() => {
    if (resetCount > 0) sceneRef.current?.resetView(true);
  }, [resetCount]);

  useEffect(() => {
    if (tide) sceneRef.current?.ripple();
  }, [tide]);

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
      className={`size-full touch-none ${backdrop ? '' : 'bg-slate-800'}`}
    />
  );
}
