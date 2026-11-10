import { LEVELS_PER_TRACK, TRACK_COUNT, trackName } from '../core/difficulty';
import type { Progress } from '../game/progress';
import { totalCleared } from '../game/progress';
import { HelpIcon, SettingsIcon } from './icons';
import { Logo } from './Logo';
import { Stage } from './Stage';

interface Props {
  readonly dark: boolean;
  readonly lowPower: boolean;
  readonly name: string;
  readonly progress: Progress;
  readonly onPlay: () => void;
  readonly onAllLevels: () => void;
  readonly onSettings: () => void;
  readonly onHelp: () => void;
}

export function HomeScreen({
  dark,
  lowPower,
  name,
  progress,
  onPlay,
  onAllLevels,
  onSettings,
  onHelp,
}: Props) {
  const { difficulty, layers, level } = progress.last;
  const cleared = totalCleared(progress);
  const total = TRACK_COUNT * LEVELS_PER_TRACK;
  return (
    <Stage dark={dark} lowPower={lowPower}>
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 rounded-full py-1.5 pr-4 pl-1.5 hud-card sm:top-6 sm:left-6">
        <span
          aria-hidden="true"
          className="grid size-9 place-items-center rounded-full bg-night font-bold text-link"
        >
          {name.slice(0, 1).toUpperCase()}
        </span>
        <span className="font-semibold">{name}</span>
      </div>
      <div className="absolute top-4 right-4 z-10 flex gap-2 sm:top-6 sm:right-6">
        <button
          type="button"
          onClick={onHelp}
          aria-label="How to play"
          className="grid size-11 place-items-center rounded-full text-lg font-bold hud-card"
        >
          <HelpIcon />
        </button>
        <button
          type="button"
          onClick={onSettings}
          aria-label="Settings"
          className="grid size-11 place-items-center rounded-full text-lg hud-card"
        >
          <SettingsIcon />
        </button>
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <Logo className="text-4xl sm:text-5xl sm:[@media(min-height:700px)]:text-7xl" />
        <p className="mt-6 text-lg font-semibold text-slate-400">
          Tap arrows. Clear the board.
        </p>
        <button
          type="button"
          onClick={onPlay}
          className="mt-6 w-full max-w-xs rounded-3xl bg-linear-to-b from-teal-200 to-teal-300 px-8 py-4 text-xl font-black text-ink shadow-[inset_0_3px_0_rgb(255_255_255/0.7),0_7px_0_var(--color-teal-700),0_14px_24px_rgb(0_0_0/0.35)] active:translate-y-1 active:shadow-[inset_0_3px_0_rgb(255_255_255/0.7),0_2px_0_var(--color-teal-700)]"
        >
          ▶︎ {cleared > 0 ? 'Continue' : 'Play'}
          <span className="block text-sm font-bold opacity-70">
            {trackName(difficulty, layers)} · Level {level}
          </span>
        </button>
        <button
          type="button"
          onClick={onAllLevels}
          className="mt-4 w-full max-w-xs rounded-2xl py-3 font-bold hud-card active:scale-[0.97]"
        >
          ▦︎ All levels
        </button>
      </div>

      <div className="absolute inset-x-0 bottom-4 flex flex-wrap items-center justify-center gap-2 px-4 sm:bottom-6">
        <p className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold hud-card">
          ★ {cleared.toLocaleString()}
          <span className="font-normal opacity-80">
            of {total.toLocaleString()} cleared
          </span>
        </p>
        <p className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold hud-card">
          💡 {progress.hints}
          <span className="font-normal opacity-80">hints</span>
        </p>
      </div>
    </Stage>
  );
}
