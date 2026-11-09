import { useCallback, useMemo, useRef, useState } from 'react';
import {
  DIFFICULTIES,
  LEVELS_PER_TRACK,
  trackName,
  UNLOCK_AFTER,
} from '../core/difficulty';
import { buildLevel } from '../core/levels';
import { headOf } from '../core/board';
import type { Arrow, Level, Vec3 } from '../core/types';
import type { ClearResult, Track } from '../game/progress';
import {
  arrowsLeft,
  hintFor,
  restart,
  startSession,
  STARTING_LIVES,
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
import { Modal, ModalButton } from './Modal';

interface Props {
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
  const board = useMemo(
    () => buildLevel(difficulty, layers, level),
    [difficulty, layers, level],
  );
  const [session, setSession] = useState<Session>(() => startSession(board));
  const [leaving, setLeaving] = useState<ReadonlyMap<number, Arrow>>(new Map());
  const [flashId, setFlashId] = useState<number | null>(null);
  const [hintId, setHintId] = useState<number | null>(null);
  const [rippleFrom, setRippleFrom] = useState<Vec3 | null>(null);
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
          if (arrow) setRippleFrom(headOf(arrow));
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
    setRippleFrom(null);
    setWinShown(false);
    setLoseShown(false);
    setPaused(false);
    setLeaving(new Map());
    setHintId(null);
    const fresh = restart(live.current);
    live.current = fresh;
    setSession(fresh);
  };

  const left = arrowsLeft(session).length;
  const lastLevel = level >= LEVELS_PER_TRACK;

  return (
    <main className="mx-auto flex h-dvh max-w-xl flex-col lg:max-w-none lg:flex-row">
      <header className="flex items-center justify-between gap-2 px-4 pt-4 lg:w-60 lg:shrink-0 lg:flex-col lg:items-stretch lg:justify-start lg:gap-5 lg:border-r lg:border-slate-800 lg:p-6">
        <button
          type="button"
          onClick={() => setPaused(true)}
          aria-label="Pause"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-800 font-bold lg:self-start"
        >
          II
        </button>
        <div className="text-center leading-tight lg:text-left">
          <h1 className="font-bold text-strong">
            {spec?.name}{' '}
            <span className={`rounded-full bg-night px-1.5 ${accent.text}`}>
              {layers}L
            </span>
          </h1>
          <p className="text-xs text-slate-400">
            Level {level} · {board.width}×{board.height}
          </p>
        </div>
        <div className="flex items-center gap-2 lg:flex-col lg:items-stretch lg:gap-3">
          <span
            aria-label={`${session.lives} lives left`}
            className="text-lg tracking-tight lg:text-3xl"
          >
            {'❤️'.repeat(session.lives)}
            {'🤍'.repeat(STARTING_LIVES - session.lives)}
          </span>
          <button
            type="button"
            onClick={onHint}
            disabled={hints <= 0}
            className="flex h-10 items-center justify-center gap-1 rounded-full bg-slate-800 px-3 text-sm font-semibold disabled:opacity-40 lg:h-12"
          >
            💡 {hints}
          </button>
        </div>
      </header>

      <div className="@container-size flex min-h-0 flex-1 items-center justify-center p-3">
        <div className="relative size-[min(100cqw,100cqh)]">
          {gl && (
            <button
              type="button"
              onClick={() => setResetCount((n) => n + 1)}
              disabled={viewDefault}
              aria-label="Reset view"
              title="Reset view"
              className="absolute top-2 right-2 z-10 grid size-11 place-items-center rounded-full border border-teal-200/60 bg-linear-to-b from-teal-200 to-teal-500 text-xl font-bold text-slate-900 shadow-[inset_0_2px_0_rgb(255_255_255/0.7),0_5px_0_var(--color-teal-700),0_8px_12px_rgb(0_0_0/0.5)] enabled:hover:brightness-110 enabled:active:translate-y-1 enabled:active:shadow-[inset_0_2px_0_rgb(255_255_255/0.7),0_1px_0_var(--color-teal-700),0_2px_4px_rgb(0_0_0/0.5)] disabled:translate-y-0.5 disabled:cursor-default disabled:border-slate-600 disabled:from-slate-600 disabled:to-slate-700 disabled:text-slate-400 disabled:shadow-[inset_0_2px_0_rgb(255_255_255/0.15),0_2px_0_var(--color-slate-800)]"
            >
              ⌖
            </button>
          )}
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
              rippleFrom={rippleFrom}
              resetCount={resetCount}
              onTap={onTap}
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
      </div>

      <aside className="flex flex-col gap-2 px-4 pb-4 lg:w-68 lg:shrink-0 lg:border-l lg:border-slate-800 lg:p-6">
        <div className="rounded-xl bg-slate-900 p-3 text-sm">
          <div className="flex items-end justify-between">
            <span className="text-slate-400">Arrows left</span>
            <b className="text-3xl text-strong">{left}</b>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full rounded-full ${accent.bg}`}
              style={{
                width: `${((board.arrows.length - left) / board.arrows.length) * 100}%`,
              }}
            />
          </div>
        </div>
        {board.layers > 1 && (
          <div className="rounded-xl bg-slate-900 p-3 text-xs text-slate-400">
            <p className="mb-2 font-semibold text-slate-300">
              Layers {board.layers}
            </p>
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
                Hide front layers
                <button
                  type="button"
                  aria-label="Hide fewer layers"
                  onClick={() => setHideFront((n) => Math.max(0, n - 1))}
                  className="size-6 rounded-sm bg-slate-800"
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
                  className="size-6 rounded-sm bg-slate-800"
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
            <p className="mt-2 text-slate-400">
              Drag to tilt. Pinch or scroll to zoom.
            </p>
          </div>
        )}
        <p className="hidden rounded-xl bg-slate-900 p-3 text-xs text-slate-400 lg:block">
          <b className="text-slate-200">Tip</b>
          <br />
          Hold an arrow to preview its path without risking a heart.
        </p>
        <button
          type="button"
          onClick={onRestart}
          className="self-center rounded-full bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-300 lg:mt-auto lg:self-stretch"
        >
          Restart level
        </button>
      </aside>

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
