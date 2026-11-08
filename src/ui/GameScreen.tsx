import { useCallback, useMemo, useRef, useState } from 'react';
import {
  DIFFICULTIES,
  LEVELS_PER_DIFFICULTY,
  UNLOCK_AFTER,
} from '../core/difficulty';
import { buildLevel } from '../core/levels';
import { headOf } from '../core/board';
import type { Arrow, Vec3 } from '../core/types';
import type { ClearResult } from '../game/progress';
import {
  arrowsLeft,
  hintFor,
  restart,
  startSession,
  STARTING_LIVES,
  tap,
  type Session,
} from '../game/session';
import type { ColorMode } from '../game/settings';
import { Board3D } from '../view/Board3D';
import { webglAvailable, type LayerView } from '../view/BoardScene';
import { FlatBoard } from '../view/FlatBoard';
import { oneColorFor } from '../view/palette';
import { accentFor } from './accents';
import { CoachMark } from './CoachMark';
import { Modal, ModalButton } from './Modal';

interface Props {
  readonly difficulty: number;
  readonly level: number;
  readonly hints: number;
  readonly colorMode: ColorMode;
  readonly lowPower: boolean;
  /** Clears needed to open the next difficulty, for the win line. */
  readonly clearedInDifficulty: number;
  readonly nextUnlocked: boolean;
  readonly onHintUsed: () => void;
  /** Called once when the level is won. Returns what the clear earned. */
  readonly onWin: () => ClearResult;
  readonly onNext: () => void;
  readonly onLevels: () => void;
  /** First-time card on Easy 1 (FR coach mark). */
  readonly showCoach: boolean;
  readonly onCoachDone: () => void;
  readonly onSettings: () => void;
  readonly onHelp: () => void;
  readonly onHome: () => void;
}

const SLIDE_MS = 320;
const FLASH_MS = 400;
/** Lets the clear ripple play before the win card covers the board. */
const WIN_DELAY_MS = 800;

export function GameScreen({
  difficulty,
  level,
  hints,
  colorMode,
  lowPower,
  clearedInDifficulty,
  nextUnlocked,
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
    () => buildLevel(difficulty, level),
    [difficulty, level],
  );
  const [session, setSession] = useState<Session>(() => startSession(board));
  const [leaving, setLeaving] = useState<ReadonlyMap<number, Arrow>>(new Map());
  const [flashId, setFlashId] = useState<number | null>(null);
  const [hintId, setHintId] = useState<number | null>(null);
  const [rippleFrom, setRippleFrom] = useState<Vec3 | null>(null);
  const [winShown, setWinShown] = useState(false);
  const [paused, setPaused] = useState(false);
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
    () => ({ gap, hideFront, xray }),
    [gap, hideFront, xray],
  );
  const accent = accentFor(difficulty);
  const oneColor = colorMode === 'one' ? oneColorFor(difficulty, level) : null;

  const onTap = useCallback(
    (arrowId: number) => {
      const r = tap(live.current, arrowId);
      if (r.outcome === 'ignored') return;
      live.current = r.session;
      setSession(r.session);
      setHintId(null);
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
          window.setTimeout(() => setWinShown(true), WIN_DELAY_MS);
          setResult(onWin());
        }
      } else {
        setFlashId(arrowId);
        window.setTimeout(() => setFlashId(null), FLASH_MS);
      }
    },
    [board, onWin],
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
    setPaused(false);
    setLeaving(new Map());
    setHintId(null);
    const fresh = restart(live.current);
    live.current = fresh;
    setSession(fresh);
  };

  const left = arrowsLeft(session).length;
  const lastLevel = level >= LEVELS_PER_DIFFICULTY;
  const nextName = DIFFICULTIES[difficulty + 1]?.name;

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-3 p-4 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)_17rem] lg:items-start lg:gap-6">
      <header className="flex items-center justify-between gap-3 lg:flex-col lg:items-stretch lg:gap-5 lg:pt-2">
        <button
          type="button"
          onClick={() => setPaused(true)}
          aria-label="Pause"
          className="grid size-11 shrink-0 place-items-center rounded-full bg-slate-800 font-bold lg:self-start"
        >
          II
        </button>
        <div className="leading-tight">
          <h1 className="font-bold text-white">
            {spec?.name} <span className={accent.text}>{level}</span>
          </h1>
          <p className="text-xs text-slate-400">
            {spec?.layers} layer{spec && spec.layers > 1 ? 's' : ''} ·{' '}
            {board.width}×{board.height}
          </p>
        </div>
        <div className="flex items-center gap-3 lg:flex-col lg:items-stretch lg:gap-3">
          <span
            aria-label={`${session.lives} lives left`}
            className="text-lg lg:text-3xl"
          >
            {'❤️'.repeat(session.lives)}
            {'🤍'.repeat(STARTING_LIVES - session.lives)}
          </span>
          <button
            type="button"
            onClick={onHint}
            disabled={hints <= 0}
            className="flex h-11 items-center justify-center gap-1 rounded-full bg-slate-800 px-3 text-sm font-semibold disabled:opacity-40"
          >
            💡 {hints}
          </button>
        </div>
      </header>

      {gl ? (
        <Board3D
          key={`${difficulty}:${level}:${lowPower}`}
          level={board}
          alive={session.alive}
          oneColor={oneColor}
          flashId={flashId}
          hintId={hintId}
          leaving={leaving}
          lowPower={lowPower}
          layerView={layerView}
          rippleFrom={rippleFrom}
          onTap={onTap}
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

      <aside className="flex flex-col gap-3 lg:pt-2">
        <div className="rounded-xl bg-slate-900 p-3 text-sm">
          <div className="flex items-end justify-between">
            <span className="text-slate-400">Arrows left</span>
            <b className="text-3xl text-white">{left}</b>
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
            <p className="mt-2 text-slate-500">
              Drag to tilt. Pinch or scroll to zoom.
            </p>
          </div>
        )}
        <p className="hidden rounded-xl bg-slate-900 p-3 text-xs text-slate-400 lg:block">
          <b className="text-slate-200">Tip</b>
          <br />A blocked arrow costs a heart, once. Look for arrows with a
          clear path first.
        </p>
        <button
          type="button"
          onClick={onRestart}
          className="self-center rounded-full bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-300 lg:self-stretch"
        >
          Restart level
        </button>
      </aside>

      {showCoach && session.status === 'playing' && (
        <CoachMark onDone={onCoachDone} />
      )}

      {paused && session.status === 'playing' && (
        <Modal>
          <h2 className="text-2xl font-bold text-white">Paused</h2>
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
            className={`mx-auto mb-2 grid size-16 place-items-center rounded-full text-3xl text-slate-950 ${accent.bg}`}
          >
            ✓
          </div>
          <h2 className="text-2xl font-bold text-white">Cleared!</h2>
          <p className="mt-1 text-sm text-slate-400">
            {spec?.name} {level}
          </p>
          {result.hintGifted && (
            <p className="mt-3 rounded-xl bg-slate-800 p-2 text-sm font-semibold text-teal-300">
              +1 hint earned
            </p>
          )}
          {result.unlocked !== undefined ? (
            <p className="mt-3 rounded-xl bg-amber-400 p-2 text-sm font-bold text-slate-950">
              {DIFFICULTIES[result.unlocked]?.name} unlocked!
            </p>
          ) : (
            nextName &&
            !nextUnlocked && (
              <p className="mt-3 text-xs text-slate-400">
                {Math.min(clearedInDifficulty, UNLOCK_AFTER)} / {UNLOCK_AFTER}{' '}
                to unlock {nextName}
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

      {session.status === 'lost' && (
        <Modal>
          <div className="text-5xl">💔</div>
          <h2 className="mt-2 text-2xl font-bold text-white">Out of hearts</h2>
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
