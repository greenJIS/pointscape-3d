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
import { Page } from './Page';

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
    <Page
      title="Choose a level set"
      onBack={onBack}
      top={
        <p className="text-sm text-slate-400">
          Difficulty sets the grid size. Layers set how many boards are stacked.
        </p>
      }
    >
      <ul className="flex flex-col gap-3">
        {DIFFICULTIES.map((d, i) => {
          const accent = accentFor(i);
          const side = levelParams(i, 1, 1).width;
          return (
            <li key={d.id} className="rounded-3xl p-3 hud-card">
              <h2
                className={`mb-2 w-fit rounded-full bg-night px-3 py-0.5 font-bold ${accent.text}`}
              >
                {d.name}{' '}
                <span className="text-sm font-normal opacity-80">
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
                        className={`grid size-9 place-items-center rounded-lg font-black text-ink ${accent.bg}`}
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
    </Page>
  );
}
