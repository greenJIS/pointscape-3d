import { useEffect, useRef } from 'react';
import {
  DIFFICULTIES,
  LEVELS_PER_DIFFICULTY,
  UNLOCK_AFTER,
} from '../core/difficulty';
import {
  clearedCount,
  isCleared,
  isDifficultyUnlocked,
  isUnlocked,
  nextLevel,
  type Progress,
} from '../game/progress';
import { accentFor } from './accents';

interface Props {
  readonly difficulty: number;
  readonly progress: Progress;
  readonly unlockAll: boolean;
  readonly onPickDifficulty: (difficulty: number) => void;
  readonly onPlay: (difficulty: number, level: number) => void;
  readonly onLocked: (message: string) => void;
  readonly onBack: () => void;
}

export function LevelsScreen({
  difficulty,
  progress,
  unlockAll,
  onPickDifficulty,
  onPlay,
  onLocked,
  onBack,
}: Props) {
  const spec = DIFFICULTIES[difficulty];
  const accent = accentFor(difficulty);
  const next = DIFFICULTIES[difficulty + 1];
  const done = clearedCount(progress, difficulty);
  const current = nextLevel(progress, difficulty);
  const currentRef = useRef<HTMLButtonElement | null>(null);

  // Bring the current level into view, so nobody scrolls past 60 cleared ones.
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center' });
  }, [difficulty]);

  return (
    <main className="mx-auto flex h-screen max-w-5xl flex-col gap-3 p-5">
      <header className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="grid size-11 place-items-center rounded-full bg-slate-800"
        >
          ←
        </button>
        <h1 className="text-xl font-bold text-white">{spec?.name}</h1>
      </header>

      <div className="flex gap-2 lg:max-w-md">
        {DIFFICULTIES.map((d, i) => {
          const open = isDifficultyUnlocked(i, progress, unlockAll);
          return (
            <button
              key={d.id}
              type="button"
              onClick={() =>
                open
                  ? onPickDifficulty(i)
                  : onLocked(
                      `Clear ${UNLOCK_AFTER} ${DIFFICULTIES[i - 1]?.name ?? ''} levels to unlock`,
                    )
              }
              className={`flex-1 rounded-lg py-2 text-xs font-bold ${
                i === difficulty
                  ? `${accentFor(i).bg} text-slate-950`
                  : open
                    ? 'bg-slate-800 text-slate-300'
                    : 'bg-slate-900 text-slate-600'
              }`}
            >
              {open ? `${d.layers}L` : '🔒'}
            </button>
          );
        })}
      </div>

      <div className="rounded-xl bg-slate-900 p-3 text-sm">
        {next ? (
          <>
            <div className="flex justify-between">
              <span className="text-slate-300">
                {isDifficultyUnlocked(difficulty + 1, progress, false)
                  ? `${next.name} unlocked`
                  : `Unlocks ${next.name}`}
              </span>
              <span className="text-slate-400">
                {Math.min(done, UNLOCK_AFTER)} / {UNLOCK_AFTER}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full ${accent.bg}`}
                style={{
                  width: `${(Math.min(done, UNLOCK_AFTER) / UNLOCK_AFTER) * 100}%`,
                }}
              />
            </div>
          </>
        ) : (
          <span className="text-slate-300">Final difficulty</span>
        )}
      </div>

      <ol className="grid min-h-0 flex-1 auto-rows-min grid-cols-5 gap-2 overflow-y-auto pb-2 lg:grid-cols-10">
        {Array.from({ length: LEVELS_PER_DIFFICULTY }, (_, k) => k + 1).map(
          (l) => {
            const open = isUnlocked(difficulty, l, progress, unlockAll);
            const cleared = isCleared(progress, difficulty, l);
            const isCurrent = l === current;
            const tone = cleared
              ? `${accent.bg} text-slate-950`
              : open
                ? `border-2 ${accent.border} bg-slate-900 text-white`
                : 'bg-slate-900 text-slate-600';
            return (
              <li key={l}>
                <button
                  type="button"
                  ref={isCurrent ? currentRef : undefined}
                  disabled={!open}
                  onClick={() => onPlay(difficulty, l)}
                  aria-label={`Level ${l}${cleared ? ', cleared' : open ? '' : ', locked'}`}
                  className={`grid aspect-square w-full place-items-center rounded-xl text-sm font-bold ${tone} ${isCurrent ? 'ring-2 ring-white/60' : ''}`}
                >
                  {cleared ? '✓' : open ? l : '🔒'}
                </button>
              </li>
            );
          },
        )}
      </ol>
    </main>
  );
}
