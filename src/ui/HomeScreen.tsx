import { trackName } from '../core/difficulty';
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
  readonly onHelp: () => void;
}

export function HomeScreen({
  name,
  progress,
  onPlay,
  onAllLevels,
  onSettings,
  onHelp,
}: Props) {
  const { difficulty, layers, level } = progress.last;
  const label =
    totalCleared(progress) > 0
      ? `Continue · ${trackName(difficulty, layers)} ${level}`
      : 'Play';
  return (
    <main className="relative mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center gap-6 p-6 lg:flex-row lg:gap-16">
      <div className="absolute top-5 right-5 flex gap-2">
        <button
          type="button"
          onClick={onHelp}
          aria-label="How to play"
          className="grid size-11 place-items-center rounded-full bg-slate-800 text-lg font-bold"
        >
          ?
        </button>
        <button
          type="button"
          onClick={onSettings}
          aria-label="Settings"
          className="grid size-11 place-items-center rounded-full bg-slate-800 text-lg"
        >
          ⚙
        </button>
      </div>
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
