import { useCallback, useMemo, useRef, useState } from 'react';
import {
  DIFFICULTIES,
  LEVELS_PER_TRACK,
  trackName,
  UNLOCK_AFTER,
} from '../core/difficulty';
import type { Arrow, Level } from '../core/types';
import type { ClearResult, Track } from '../game/progress';
import {
  arrowsLeft,
  hintFor,
  restart,
  livesFor,
  startSession,
  tap,
  type Session,
} from '../game/session';
import {
  ARROW_SPEED_RATE,
  type ArrowSpeed,
  type ColorMode,
} from '../game/settings';
import { Board3D } from '../view/Board3D';
import { webglAvailable, type LayerView } from '../view/BoardScene';
import { FlatBoard } from '../view/FlatBoard';
import { ANIM, arrowPath, slideDistance } from '../view/path';
import { playSound } from '../view/sound';
import { accentFor } from './accents';
import { CoachMark } from './CoachMark';
import { Loading } from './Loading';
import { PauseIcon } from './icons';
import { Modal, ModalButton } from './Modal';

interface Props {
  /** The built level. `LevelGate` builds it off the main thread. */
  readonly board: Level;
  readonly difficulty: number;
  readonly layers: number;
  readonly level: number;
  readonly hints: number;
  /** True for the dark look. The 3D scene needs it, since it does not use CSS. */
  readonly dark: boolean;
  readonly colorMode: ColorMode;
  /** The colour picked in Settings for one-color mode. */
  readonly oneColor: string;
  readonly lowPower: boolean;
  readonly sound: boolean;
  readonly arrowSpeed: ArrowSpeed;
  readonly showLayers: boolean;
  readonly showDots: boolean;
  /** Clears so far in this track, for the win line. */
  readonly clearedInTrack: number;
  /** Tracks that clearing UNLOCK_AFTER levels here opens, and that are still locked. */
  readonly pendingTracks: readonly Track[];
  readonly onHintUsed: () => void;
  /** Called once when the level is won. Returns what the clear earned. */
  readonly onWin: () => ClearResult;
  readonly onNext: () => void;
  readonly onLevels: () => void;
  /** First-time card on Tiny 1 (FR coach mark). */
  readonly showCoach: boolean;
  readonly onCoachDone: () => void;
  readonly onSettings: () => void;
  readonly onHelp: () => void;
  readonly onHome: () => void;
}

const SLIDE_MS = 320;
const FLASH_MS = 400;

/** Seconds the last arrow takes to slide off the board. */
function slideSeconds(
  board: Level,
  arrow: Arrow | undefined,
  rate: number,
): number {
  if (!arrow) return 0;
  const finish = arrowPath(board, arrow).finish;
  let t = 0;
  while (slideDistance(t, rate) < finish) t += 0.01;
  return t;
}

export function GameScreen({
  board,
  difficulty,
  layers,
  level,
  hints,
  dark,
  colorMode,
  oneColor: chosenColor,
  lowPower,
  sound,
  arrowSpeed,
  showLayers,
  showDots,
  clearedInTrack,
  pendingTracks,
  onHintUsed,
  onWin,
  onNext,
  onLevels,
  showCoach,
  onCoachDone,
  onSettings,
  onHelp,
  onHome,
}: Props) {
  const [session, setSession] = useState<Session>(() =>
    startSession(board, livesFor(difficulty, layers)),
  );
  const [leaving, setLeaving] = useState<ReadonlyMap<number, Arrow>>(new Map());
  const [flashId, setFlashId] = useState<number | null>(null);
  const [hintId, setHintId] = useState<number | null>(null);
  const [tide, setTide] = useState(false);
  const [winShown, setWinShown] = useState(false);
  const [loseShown, setLoseShown] = useState(false);
  const [paused, setPaused] = useState(false);
  const [resetCount, setResetCount] = useState(0);
  const [viewDefault, setViewDefault] = useState(true);
  const [result, setResult] = useState<ClearResult | null>(null);
  const [gap, setGap] = useState(0.3);
  const [hideFront, setHideFront] = useState(0);
  const [xray, setXray] = useState(false);
  const [gl] = useState(webglAvailable);
  // The flat fallback draws at once. The 3D board reports when its first frame is up.
  const [boardReady, setBoardReady] = useState(!gl);
  const reported = useRef(false);
  // Latest session, readable by a tap that lands before React re-renders.
  const live = useRef(session);
  const spec = DIFFICULTIES[difficulty];
  const layerView = useMemo<LayerView>(
    () => ({ gap, hideFront, xray, showLayers, showDots }),
    [gap, hideFront, xray, showLayers, showDots],
  );
  const slideRate = ARROW_SPEED_RATE[arrowSpeed];
  const accent = accentFor(difficulty);
  const oneColor = colorMode === 'one' ? chosenColor : null;

  const onTap = useCallback(
    (arrowId: number) => {
      const r = tap(live.current, arrowId);
      if (r.outcome === 'ignored') return;
      live.current = r.session;
      setSession(r.session);
      setHintId(null);
      if (r.session.status === 'lost') {
        window.setTimeout(() => {
          setLoseShown(true);
          if (sound) playSound('lose');
        }, ANIM.loseCard * 1000);
      }
      // The win and lose sounds wait for their modal, so the tap itself only gets its own sound.
      if (sound) playSound(r.outcome === 'exit' ? 'exit' : 'blocked');
      if (r.outcome === 'exit') {
        const arrow = board.arrows.find((a) => a.id === arrowId);
        if (arrow) {
          setLeaving((m) => new Map(m).set(arrowId, arrow));
          window.setTimeout(
            () =>
              setLeaving((m) => {
                const next = new Map(m);
                next.delete(arrowId);
                return next;
              }),
            SLIDE_MS,
          );
        }
        if (r.session.status === 'won' && !reported.current) {
          reported.current = true;
          if (arrow) setTide(true);
          window.setTimeout(
            () => {
              setWinShown(true);
              if (sound) playSound('win');
            },
            (slideSeconds(board, arrow, slideRate) + ANIM.winCard) * 1000,
          );
          setResult(onWin());
        }
      } else {
        setFlashId(arrowId);
        window.setTimeout(() => setFlashId(null), FLASH_MS);
      }
    },
    [board, onWin, sound, slideRate],
  );

  const onHint = () => {
    if (hints <= 0 || live.current.status !== 'playing') return;
    const id = hintFor(live.current);
    if (id === undefined) return;
    onHintUsed();
    setHintId(id);
  };

  const onRestart = () => {
    reported.current = false;
    setResult(null);
    setTide(false);
    setWinShown(false);
    setLoseShown(false);
    setPaused(false);
    setLeaving(new Map());
    setHintId(null);
    const fresh = restart(live.current);
    live.current = fresh;
    setSession(fresh);
  };

  const [layersOpen, setLayersOpen] = useState(false);
  const left = arrowsLeft(session).length;
  const lastLevel = level >= LEVELS_PER_TRACK;

  return (
    <main className="relative h-dvh overflow-hidden">
      {!boardReady && (
        <Loading
          label="Drawing board"
          detail={`${trackName(difficulty, layers)} · Level ${level}`}
          overlay
        />
      )}
      <div className="absolute inset-0">
        {gl ? (
          <Board3D
            key={`${difficulty}:${layers}:${level}:${lowPower}`}
            level={board}
            alive={session.alive}
            oneColor={oneColor}
            flashId={flashId}
            hintId={hintId}
            leaving={leaving}
            lowPower={lowPower}
            dark={dark}
            slideRate={slideRate}
            layerView={layerView}
            tide={tide}
            resetCount={resetCount}
            onTap={onTap}
            onReady={() => setBoardReady(true)}
            onViewChange={setViewDefault}
          />
        ) : (
          <FlatBoard
            level={board}
            alive={session.alive}
            oneColor={oneColor}
            flashId={flashId}
            hintId={hintId}
            leaving={leaving}
            onTap={onTap}
          />
        )}
      </div>

      <div className="pointer-events-none absolute inset-0 p-3 *:pointer-events-auto sm:p-5">
        <div className="absolute top-3 left-3 flex items-center gap-2 sm:top-5 sm:left-5">
          <button
            type="button"
            onClick={() => setPaused(true)}
            aria-label="Pause"
            className="grid size-11 place-items-center rounded-full font-bold hud-card"
          >
            <PauseIcon />
          </button>
          <div className="rounded-2xl px-3 py-1.5 leading-tight hud-card">
            <h1 className="font-bold">
              {spec?.name}{' '}
              <span className={`rounded-full bg-night px-1.5 ${accent.text}`}>
                {layers}L
              </span>
            </h1>
            <p className="text-xs opacity-80">
              Level {level} · {board.width}×{board.height}
            </p>
          </div>
        </div>

        <span
          aria-label={`${session.lives} lives left`}
          className="absolute top-18 left-3 rounded-full px-3 py-1.5 text-lg tracking-tight hud-card sm:top-5 sm:left-1/2 sm:-translate-x-1/2 sm:text-2xl"
        >
          {'❤️'.repeat(session.lives)}
          {'🤍'.repeat(session.maxLives - session.lives)}
        </span>

        <div className="absolute top-3 right-3 flex flex-col items-end gap-2 sm:top-5 sm:right-5">
          <div className="w-36 rounded-2xl p-2.5 text-sm hud-card sm:w-44">
            <div className="flex items-end justify-between">
              <span className="text-xs opacity-80">Arrows left</span>
              <b className="text-2xl leading-none sm:text-3xl">{left}</b>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-500/40">
              <div
                className={`h-full rounded-full ${accent.bg}`}
                style={{
                  width: `${((board.arrows.length - left) / board.arrows.length) * 100}%`,
                }}
              />
            </div>
          </div>
          {gl && (
            <button
              type="button"
              onClick={() => setResetCount((n) => n + 1)}
              disabled={viewDefault}
              aria-label="Reset view"
              title="Reset view"
              className="grid size-11 place-items-center rounded-full border border-teal-200/60 bg-linear-to-b from-teal-200 to-teal-500 text-xl font-bold text-slate-900 shadow-[inset_0_2px_0_rgb(255_255_255/0.7),0_5px_0_var(--color-teal-700),0_8px_12px_rgb(0_0_0/0.5)] enabled:hover:brightness-110 enabled:active:translate-y-1 enabled:active:shadow-[inset_0_2px_0_rgb(255_255_255/0.7),0_1px_0_var(--color-teal-700),0_2px_4px_rgb(0_0_0/0.5)] disabled:translate-y-0.5 disabled:cursor-default disabled:border-slate-600 disabled:from-slate-600 disabled:to-slate-700 disabled:text-slate-400 disabled:shadow-[inset_0_2px_0_rgb(255_255_255/0.15),0_2px_0_var(--color-slate-800)]"
            >
              ⌖
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onHint}
          disabled={hints <= 0}
          className="absolute bottom-3 left-3 flex h-12 items-center justify-center gap-2 rounded-full px-4 font-semibold hud-card disabled:opacity-40 sm:bottom-5 sm:left-5"
        >
          💡 {hints}
        </button>

        <p className="absolute bottom-3 left-1/2 hidden w-[min(22rem,calc(100%-14rem))] -translate-x-1/2 rounded-2xl px-3 py-2 text-center text-xs hud-card sm:bottom-5 sm:text-sm sm:[@media(min-height:720px)]:block">
          <b>Tip</b> · Hold an arrow to preview its path without risking a
          heart.
        </p>

        <div className="absolute right-3 bottom-3 flex flex-col items-end gap-2 sm:right-5 sm:bottom-5">
          {board.layers > 1 && layersOpen && (
            <div className="w-64 rounded-2xl p-3 text-xs hud-card">
              <p className="mb-2 font-semibold">Layers {board.layers}</p>
              <label className="flex items-center gap-2">
                Layer gap
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={gap}
                  onChange={(e) => setGap(Number(e.target.value))}
                  className="flex-1"
                />
              </label>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1">
                  Hide front
                  <button
                    type="button"
                    aria-label="Hide fewer layers"
                    onClick={() => setHideFront((n) => Math.max(0, n - 1))}
                    className="size-6 rounded-sm bg-slate-500/30"
                  >
                    -
                  </button>
                  <b>{hideFront}</b>
                  <button
                    type="button"
                    aria-label="Hide more layers"
                    onClick={() =>
                      setHideFront((n) => Math.min(board.layers - 1, n + 1))
                    }
                    className="size-6 rounded-sm bg-slate-500/30"
                  >
                    +
                  </button>
                </span>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={xray}
                    onChange={(e) => setXray(e.target.checked)}
                  />
                  X-ray
                </label>
              </div>
              <p className="mt-2 opacity-80">
                Drag to tilt. Pinch or scroll to zoom.
              </p>
            </div>
          )}
          <div className="flex gap-2">
            {board.layers > 1 && (
              <button
                type="button"
                aria-expanded={layersOpen}
                onClick={() => setLayersOpen((o) => !o)}
                className="h-12 rounded-full px-4 text-sm font-semibold hud-card"
              >
                ▤ Layers
              </button>
            )}
            <button
              type="button"
              onClick={onRestart}
              className="h-12 rounded-full px-4 text-sm font-semibold hud-card"
            >
              ↻ Restart
            </button>
          </div>
        </div>
      </div>

      {showCoach && session.status === 'playing' && (
        <CoachMark onDone={onCoachDone} />
      )}

      {paused && session.status === 'playing' && (
        <Modal>
          <h2 className="text-2xl font-bold text-strong">Paused</h2>
          <div className="mt-5 flex flex-col gap-2">
            <ModalButton
              label="Resume"
              primary
              onClick={() => setPaused(false)}
            />
            <ModalButton label="Restart level" onClick={onRestart} />
            <ModalButton label="Levels" onClick={onLevels} />
            <ModalButton
              label="How to play"
              onClick={() => {
                setPaused(false);
                onHelp();
              }}
            />
            <ModalButton
              label="Settings"
              onClick={() => {
                setPaused(false);
                onSettings();
              }}
            />
            <ModalButton label="Home" onClick={onHome} />
          </div>
        </Modal>
      )}

      {session.status === 'won' && result && winShown && (
        <Modal>
          <div
            className={`mx-auto mb-2 grid size-16 place-items-center rounded-full text-3xl text-ink ${accent.bg}`}
          >
            ✓
          </div>
          <h2 className="text-2xl font-bold text-strong">Cleared!</h2>
          <p className="mt-1 text-sm text-slate-400">
            {trackName(difficulty, layers)} · {level}
          </p>
          {result.hintGifted && (
            <p className="mt-3 rounded-xl bg-night p-2 text-sm font-semibold text-link">
              +1 hint earned
            </p>
          )}
          {result.unlocked.length > 0 ? (
            <p className="mt-3 rounded-xl bg-amber-400 p-2 text-sm font-bold text-ink">
              {result.unlocked
                .map((t) => trackName(t.difficulty, t.layers))
                .join(' and ')}{' '}
              unlocked!
            </p>
          ) : (
            pendingTracks.length > 0 && (
              <p className="mt-3 text-xs text-slate-400">
                {Math.min(clearedInTrack, UNLOCK_AFTER)} / {UNLOCK_AFTER} to
                unlock{' '}
                {pendingTracks
                  .map((t) => trackName(t.difficulty, t.layers))
                  .join(' and ')}
              </p>
            )
          )}
          <div className="mt-5 flex flex-col gap-2">
            {lastLevel ? (
              <ModalButton label="Levels" primary onClick={onLevels} />
            ) : (
              <ModalButton label="Next level" primary onClick={onNext} />
            )}
            <ModalButton label="Play again" onClick={onRestart} />
            {!lastLevel && <ModalButton label="Levels" onClick={onLevels} />}
          </div>
        </Modal>
      )}

      {session.status === 'lost' && loseShown && (
        <Modal>
          <div className="text-5xl">💔</div>
          <h2 className="mt-2 text-2xl font-bold text-strong">Out of hearts</h2>
          <p className="mt-1 text-sm text-slate-400">
            Look for arrows with a clear path first.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <ModalButton label="Try again" primary onClick={onRestart} />
            <ModalButton label="Levels" onClick={onLevels} />
          </div>
        </Modal>
      )}
    </main>
  );
}
