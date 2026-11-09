import {
  DIFFICULTIES,
  LAYER_COUNTS,
  LEVELS_PER_TRACK,
  trackName,
  UNLOCK_AFTER,
} from '../core/difficulty';
import { levelParams } from '../core/levels';
import {
  clearedCount,
  isTrackUnlocked,
  prerequisite,
  type Progress,
} from '../game/progress';
import { accentFor } from './accents';

interface Props {
  readonly progress: Progress;
  readonly unlockAll: boolean;
  readonly onPick: (difficulty: number, layers: number) => void;
  readonly onLocked: (message: string) => void;
  readonly onBack: () => void;
}

/** One row per difficulty, one button per board size (1L to 5L). */
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
        <h1 className="text-xl font-bold text-white">Choose a level set</h1>
      </header>
      <p className="text-sm text-slate-400">
        Difficulty sets the grid size. Layers set how many boards are stacked.
      </p>
      <ul className="flex flex-col gap-3">
        {DIFFICULTIES.map((d, i) => {
          const accent = accentFor(i);
          const side = levelParams(i, 1, 1).width;
          return (
            <li
              key={d.id}
              className="rounded-2xl border border-slate-700 bg-slate-900 p-3"
            >
              <h2 className={`mb-2 font-bold ${accent.text}`}>
                {d.name}{' '}
                <span className="text-sm font-normal text-slate-400">
                  {side}×{side}
                </span>
              </h2>
              <div className="grid grid-cols-5 gap-2">
                {LAYER_COUNTS.map((layers) => {
                  const open = isTrackUnlocked(i, layers, progress, unlockAll);
                  const need = prerequisite(i, layers);
                  return (
                    <button
                      key={layers}
                      type="button"
                      aria-label={trackName(i, layers)}
                      onClick={() =>
                        open
                          ? onPick(i, layers)
                          : onLocked(
                              need
                                ? `Clear ${UNLOCK_AFTER} ${trackName(need.difficulty, need.layers)} levels to unlock`
                                : 'Locked',
                            )
                      }
                      className={`flex flex-col items-center rounded-xl border border-slate-700 bg-slate-800 py-2 active:scale-95 ${open ? '' : 'opacity-40'}`}
                    >
                      <span
                        className={`grid size-9 place-items-center rounded-lg font-black text-slate-950 ${accent.bg}`}
                      >
                        {open ? `${layers}L` : '🔒'}
                      </span>
                      <span className="text-xs text-slate-400">
                        {open
                          ? `${clearedCount(progress, i, layers)}/${LEVELS_PER_TRACK}`
                          : ' '}
                      </span>
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
