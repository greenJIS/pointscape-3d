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
        <p className="max-w-prose text-base text-slate-300">
          Difficulty sets the grid size. Layers set how many boards are stacked.
        </p>
      }
    >
      <ul className="flex flex-col gap-4">
        {DIFFICULTIES.map((d, i) => {
          const accent = accentFor(i);
          const side = levelParams(i, 1, 1).width;
          return (
            <li key={d.id} className="rounded-3xl p-4 hud-card">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3">
                <h2
                  className={`flex w-fit items-center gap-2 rounded-full bg-night py-1 pr-3.5 pl-2.5 text-xl font-extrabold ${accent.text}`}
                >
                  <span
                    aria-hidden="true"
                    className={`size-2.5 rounded-full ${accent.bg}`}
                  />
                  {d.name}
                </h2>
                <span className="text-[15px] font-semibold text-slate-300">
                  {side}×{side} grid
                </span>
              </div>
              <div className="grid grid-cols-5 gap-2.5">
                {LAYER_COUNTS.map((layers) => {
                  const open = isTrackUnlocked(i, layers, progress, unlockAll);
                  const need = prerequisite(i, layers);
                  const cleared = clearedCount(progress, i, layers);
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
                      className={`flex flex-col items-center gap-0.5 rounded-2xl border-2 px-1 pt-2.5 pb-2 transition-transform active:scale-95 ${open ? `border-transparent text-ink ${accent.bg}` : 'border-dashed border-slate-500 bg-slate-800 text-slate-300'}`}
                    >
                      {open ? (
                        <>
                          <span className="text-3xl/tight font-black">
                            {layers}
                            <small className="ml-px text-base font-extrabold">
                              L
                            </small>
                          </span>
                          <span className="text-[13px] font-bold">
                            {cleared}/{LEVELS_PER_TRACK}
                          </span>
                          <span className="mt-0.5 h-1.5 w-7/10 overflow-hidden rounded-full bg-ink/25">
                            <span
                              className="block h-full rounded-full bg-ink"
                              style={{
                                width: `${(cleared / LEVELS_PER_TRACK) * 100}%`,
                              }}
                            />
                          </span>
                        </>
                      ) : (
                        <>
                          <span
                            aria-hidden="true"
                            className="text-2xl/snug grayscale"
                          >
                            🔒
                          </span>
                          <span className="text-[13px] font-semibold">
                            {layers} {layers === 1 ? 'layer' : 'layers'}
                          </span>
                        </>
                      )}
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
