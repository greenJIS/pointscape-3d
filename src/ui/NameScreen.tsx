import { useState } from 'react';
import { MAX_NAME_LENGTH } from '../game/playerName';
import { Logo } from './Logo';
import { Stage } from './Stage';

interface Props {
  readonly dark: boolean;
  readonly lowPower: boolean;
  /** Raw text. An empty string means "give me an animal name". */
  readonly onDone: (raw: string) => void;
}

export function NameScreen({ dark, lowPower, onDone }: Props) {
  const [text, setText] = useState('');
  return (
    <Stage dark={dark} lowPower={lowPower}>
      <div className="absolute inset-0 grid place-items-center p-6">
        <form
          className="flex w-full max-w-sm flex-col items-center text-center"
          onSubmit={(e) => {
            e.preventDefault();
            onDone(text);
          }}
        >
          <p className="text-lg font-semibold text-slate-400">Welcome to</p>
          <Logo className="mt-1 text-4xl sm:text-5xl" />
          <label htmlFor="name" className="mt-6 font-semibold text-slate-400">
            What&apos;s your name?
          </label>
          <input
            id="name"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MAX_NAME_LENGTH}
            autoComplete="off"
            placeholder="Your name"
            className="mt-2 w-full rounded-2xl px-4 py-3 text-center text-lg font-semibold hud-card outline-none focus:border-teal-300"
          />
          <p className="mt-2 text-xs text-slate-400">
            Up to {MAX_NAME_LENGTH} characters. Saved on this device only.
            Change it any time in Settings.
          </p>
          <button
            type="submit"
            className="mt-5 w-full rounded-3xl bg-linear-to-b from-teal-200 to-teal-300 py-4 text-xl font-black text-ink shadow-[inset_0_3px_0_rgb(255_255_255/0.7),0_7px_0_var(--color-teal-700),0_14px_24px_rgb(0_0_0/0.35)] active:translate-y-1 active:shadow-[inset_0_3px_0_rgb(255_255_255/0.7),0_2px_0_var(--color-teal-700)]"
          >
            Continue
          </button>
          <button
            type="button"
            onClick={() => onDone('')}
            className="mt-4 rounded-full px-4 py-2 text-sm font-semibold hud-card"
          >
            Skip
          </button>
        </form>
      </div>
    </Stage>
  );
}
