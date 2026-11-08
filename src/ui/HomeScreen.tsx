import { DIFFICULTIES } from '../core/difficulty';
import type { Progress } from '../game/progress';
import { totalCleared } from '../game/progress';
import { HeroBoard } from './HeroBoard';
import { Logo } from './Logo';

interface Props {
  readonly name: string;
  readonly progress: Progress;
  readonly onPlay: () => void;
  readonly onAllLevels: () => void;
  readonly onSettings: () => void;
}

export function HomeScreen({
  name,
  progress,
  onPlay,
  onAllLevels,
  onSettings,
}: Props) {
  const { difficulty, level } = progress.last;
  const label =
    totalCleared(progress) > 0
      ? `Continue · ${DIFFICULTIES[difficulty]?.name ?? ''} ${level}`
      : 'Play';
  return (
    <main className="relative mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center gap-6 p-6 lg:flex-row lg:gap-16">
      <button
        type="button"
        onClick={onSettings}
        aria-label="Settings"
        className="absolute top-5 right-5 grid size-11 place-items-center rounded-full bg-slate-800 text-lg"
      >
        ⚙
      </button>
      <HeroBoard />
      <div className="flex w-full max-w-sm flex-col items-center lg:items-start">
        <Logo className="text-4xl lg:items-start" />
        <p className="mt-3 text-lg font-semibold text-teal-300">Hi, {name}</p>
        <p className="mt-1 text-slate-400">Tap arrows. Clear the board.</p>
        <div className="mt-6 flex w-full flex-col gap-3">
          <button
            type="button"
            onClick={onPlay}
            className="rounded-2xl bg-teal-300 py-4 text-lg font-bold text-slate-950 active:scale-[0.97]"
          >
            {label}
          </button>
          <button
            type="button"
            onClick={onAllLevels}
            className="rounded-2xl bg-slate-800 py-3 font-semibold text-white active:scale-[0.97]"
          >
            All levels
          </button>
        </div>
      </div>
    </main>
  );
}
