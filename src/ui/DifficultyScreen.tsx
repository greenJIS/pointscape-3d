import {
  DIFFICULTIES,
  LEVELS_PER_DIFFICULTY,
  UNLOCK_AFTER,
} from '../core/difficulty';
import { levelParams } from '../core/levels';
import {
  clearedCount,
  isDifficultyUnlocked,
  type Progress,
} from '../game/progress';
import { accentFor } from './accents';

interface Props {
  readonly progress: Progress;
  readonly unlockAll: boolean;
  readonly onPick: (difficulty: number) => void;
  readonly onLocked: (message: string) => void;
  readonly onBack: () => void;
}

export function DifficultyScreen({
  progress,
  unlockAll,
  onPick,
  onLocked,
  onBack,
}: Props) {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-4 p-5">
      <header className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="grid size-11 place-items-center rounded-full bg-slate-800"
        >
          ←
        </button>
        <h1 className="text-xl font-bold text-white">Choose difficulty</h1>
      </header>
      <ul className="grid gap-3 lg:grid-cols-3">
        {DIFFICULTIES.map((d, i) => {
          const open = isDifficultyUnlocked(i, progress, unlockAll);
          const accent = accentFor(i);
          const side = levelParams(i, 1).width;
          const prev = DIFFICULTIES[i - 1];
          return (
            <li key={d.id}>
              <button
                type="button"
                onClick={() =>
                  open
                    ? onPick(i)
                    : onLocked(
                        `Clear ${UNLOCK_AFTER} ${prev?.name ?? ''} levels to unlock`,
                      )
                }
                className={`flex w-full items-center gap-4 rounded-2xl border border-slate-700 bg-slate-900 p-4 text-left active:scale-[0.98] lg:h-full lg:flex-col lg:items-start ${open ? '' : 'opacity-50'}`}
              >
                <span
                  className={`grid size-14 shrink-0 place-items-center rounded-xl text-xl font-black text-slate-950 ${accent.bg}`}
                >
                  {open ? d.layers : '🔒'}
                </span>
                <span>
                  <span className="block font-bold text-white">{d.name}</span>
                  <span className="block text-sm text-slate-400">
                    {d.layers} layer{d.layers > 1 ? 's' : ''} · {side}×{side}{' '}
                    start
                  </span>
                  <span className="block text-sm text-slate-400">
                    {open
                      ? `${clearedCount(progress, i)} / ${LEVELS_PER_DIFFICULTY} cleared`
                      : `Clear ${UNLOCK_AFTER} ${prev?.name ?? ''} levels`}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
