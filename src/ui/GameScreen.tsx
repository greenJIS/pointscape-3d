import { useCallback, useMemo, useRef, useState } from 'react';
import { DIFFICULTIES } from '../core/difficulty';
import { buildLevel } from '../core/levels';
import type { Arrow } from '../core/types';
import {
  arrowsLeft,
  hintFor,
  restart,
  startSession,
  STARTING_LIVES,
  tap,
  type Session,
} from '../game/session';
import { FlatBoard } from '../view/FlatBoard';

interface Props {
  readonly difficulty: number;
  readonly level: number;
  readonly hints: number;
  readonly onHintUsed: () => void;
  readonly onWin: () => void;
  readonly onNext: () => void;
}

const SLIDE_MS = 320;
const FLASH_MS = 400;

export function GameScreen({
  difficulty,
  level,
  hints,
  onHintUsed,
  onWin,
  onNext,
}: Props) {
  const board = useMemo(
    () => buildLevel(difficulty, level),
    [difficulty, level],
  );
  const [session, setSession] = useState<Session>(() => startSession(board));
  const [leaving, setLeaving] = useState<ReadonlyMap<number, Arrow>>(new Map());
  const [flashId, setFlashId] = useState<number | null>(null);
  const [hintId, setHintId] = useState<number | null>(null);
  const reported = useRef(false);
  // Latest session, readable by a tap that lands before React re-renders.
  const live = useRef(session);
  const commit = (next: Session) => {
    live.current = next;
    setSession(next);
  };
  const spec = DIFFICULTIES[difficulty];

  const onTap = useCallback(
    (arrowId: number) => {
      const result = tap(live.current, arrowId);
      if (result.outcome === 'ignored') return;
      live.current = result.session;
      setSession(result.session);
      setHintId(null);
      if (result.outcome === 'exit') {
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
        if (result.session.status === 'won' && !reported.current) {
          reported.current = true;
          onWin();
        }
      } else {
        setFlashId(arrowId);
        window.setTimeout(() => setFlashId(null), FLASH_MS);
      }
    },
    [board, onWin],
  );

  const onHint = () => {
    if (hints <= 0 || session.status !== 'playing') return;
    const id = hintFor(live.current);
    if (id === undefined) return;
    onHintUsed();
    setHintId(id);
  };

  const onRestart = () => {
    reported.current = false;
    setLeaving(new Map());
    commit(restart(live.current));
  };

  const left = arrowsLeft(session).length;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-3 p-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-white">
            {spec?.name} {level}
          </h1>
          <p className="text-xs text-slate-400">
            {spec?.layers} layer{spec && spec.layers > 1 ? 's' : ''} ·{' '}
            {board.width}×{board.height} · {left} left
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span aria-label={`${session.lives} lives left`} className="text-lg">
            {'❤️'.repeat(session.lives)}
            {'🤍'.repeat(STARTING_LIVES - session.lives)}
          </span>
          <button
            type="button"
            onClick={onHint}
            disabled={hints <= 0}
            className="rounded-full bg-slate-800 px-3 py-2 text-sm font-semibold disabled:opacity-40"
          >
            💡 {hints}
          </button>
        </div>
      </header>

      <FlatBoard
        level={board}
        alive={session.alive}
        oneColor={null}
        flashId={flashId}
        hintId={hintId}
        leaving={leaving}
        onTap={onTap}
      />

      <button
        type="button"
        onClick={onRestart}
        className="self-center rounded-full bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-300"
      >
        Restart level
      </button>

      {session.status !== 'playing' && (
        <div className="fixed inset-0 z-10 grid place-items-center bg-slate-950/80 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-slate-700 bg-slate-900 p-6 text-center shadow-2xl">
            <h2 className="text-2xl font-bold text-white">
              {session.status === 'won' ? 'Cleared!' : 'Out of hearts'}
            </h2>
            <div className="mt-5 flex flex-col gap-2">
              {session.status === 'won' ? (
                <button
                  type="button"
                  onClick={onNext}
                  className="rounded-2xl bg-teal-300 py-3 font-bold text-slate-950"
                >
                  Next level
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onRestart}
                  className="rounded-2xl bg-teal-300 py-3 font-bold text-slate-950"
                >
                  Try again
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
