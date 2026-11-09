import { useEffect, useRef } from 'react';
import {
  DIFFICULTIES,
  LAYER_COUNTS,
  LEVELS_PER_TRACK,
  trackName,
  UNLOCK_AFTER,
} from '../core/difficulty';
import {
  clearedCount,
  isCleared,
  isTrackUnlocked,
  isUnlocked,
  nextLevel,
  opens,
  prerequisite,
  type Progress,
} from '../game/progress';
import { accentFor } from './accents';

interface Props {
  readonly difficulty: number;
  readonly layers: number;
  readonly progress: Progress;
  readonly unlockAll: boolean;
  readonly onPickTrack: (difficulty: number, layers: number) => void;
  readonly onPlay: (difficulty: number, layers: number, level: number) => void;
  readonly onLocked: (message: string) => void;
  readonly onBack: () => void;
}

export function LevelsScreen({
  difficulty,
  layers,
  progress,
  unlockAll,
  onPickTrack,
  onPlay,
  onLocked,
  onBack,
}: Props) {
  const accent = accentFor(difficulty);
  const done = clearedCount(progress, difficulty, layers);
  const current = nextLevel(progress, difficulty, layers);
  const opening = opens(difficulty, layers);
  const currentRef = useRef<HTMLButtonElement | null>(null);

  // Bring the current level into view, so nobody scrolls past 60 cleared ones.
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center' });
  }, [difficulty, layers]);

  const pick = (d: number, l: number) => {
    if (isTrackUnlocked(d, l, progress, unlockAll)) {
      onPickTrack(d, l);
      return;
    }
    const need = prerequisite(d, l);
    onLocked(
      need
        ? `Clear ${UNLOCK_AFTER} ${trackName(need.difficulty, need.layers)} levels to unlock`
        : 'Locked',
    );
  };

  const tab = (d: number, l: number, label: string, active: boolean) => {
    const open = isTrackUnlocked(d, l, progress, unlockAll);
    return (
      <button
        key={label}
        type="button"
        onClick={() => pick(d, l)}
        className={`flex-1 rounded-lg py-2 text-xs font-bold ${
          active
            ? `${accentFor(d).bg} text-ink`
            : open
              ? 'bg-slate-800 text-slate-300'
              : 'bg-slate-900 text-slate-500'
        }`}
      >
        {open ? label : '🔒'}
      </button>
    );
  };

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
        <h1 className="text-xl font-bold text-strong">
          {trackName(difficulty, layers)}
        </h1>
      </header>

      <div className="flex flex-col gap-2 lg:max-w-md">
        <div className="flex gap-2" role="group" aria-label="Difficulty">
          {DIFFICULTIES.map((d, i) => tab(i, layers, d.name, i === difficulty))}
        </div>
        <div className="flex gap-2" role="group" aria-label="Layers">
          {LAYER_COUNTS.map((l) => tab(difficulty, l, `${l}L`, l === layers))}
        </div>
      </div>

      <div className="rounded-xl bg-slate-900 p-3 text-sm">
        {opening.length > 0 ? (
          <>
            <div className="flex justify-between">
              <span className="text-slate-300">
                {opening.every((t) =>
                  isTrackUnlocked(t.difficulty, t.layers, progress, false),
                )
                  ? 'Unlocked: '
                  : 'Unlocks '}
                {opening
                  .map((t) => trackName(t.difficulty, t.layers))
                  .join(' and ')}
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
          <span className="text-slate-300">Final level set</span>
        )}
      </div>

      <ol className="grid min-h-0 flex-1 auto-rows-min grid-cols-5 gap-2 overflow-y-auto pb-2 lg:grid-cols-10">
        {Array.from({ length: LEVELS_PER_TRACK }, (_, k) => k + 1).map((l) => {
          const open = isUnlocked(difficulty, layers, l, progress, unlockAll);
          const cleared = isCleared(progress, difficulty, layers, l);
          const isCurrent = l === current;
          const tone = cleared
            ? `${accent.bg} text-ink`
            : open
              ? `border-2 ${accent.border} bg-slate-900 text-strong`
              : 'bg-slate-900 text-slate-500';
          return (
            <li key={l}>
              <button
                type="button"
                ref={isCurrent ? currentRef : undefined}
                disabled={!open}
                onClick={() => onPlay(difficulty, layers, l)}
                aria-label={`Level ${l}${cleared ? ', cleared' : open ? '' : ', locked'}`}
                className={`grid aspect-square w-full place-items-center rounded-xl text-sm font-bold ${tone} ${isCurrent ? 'ring-2 ring-strong/60' : ''}`}
              >
                {cleared ? '✓' : open ? l : '🔒'}
              </button>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
