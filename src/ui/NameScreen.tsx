import { useState } from 'react';
import { MAX_NAME_LENGTH } from '../game/playerName';
import { Logo } from './Logo';

interface Props {
  /** Raw text. An empty string means "give me an animal name". */
  readonly onDone: (raw: string) => void;
}

export function NameScreen({ onDone }: Props) {
  const [text, setText] = useState('');
  return (
    <main className="mx-auto grid min-h-screen max-w-sm place-items-center p-6">
      <form
        className="flex w-full flex-col items-center text-center"
        onSubmit={(e) => {
          e.preventDefault();
          onDone(text);
        }}
      >
        <p className="text-slate-400">Welcome to</p>
        <Logo className="mt-1 text-3xl" />
        <label htmlFor="name" className="mt-6 text-slate-400">
          What&apos;s your name?
        </label>
        <input
          id="name"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX_NAME_LENGTH}
          autoComplete="off"
          placeholder="Your name"
          className="mt-2 w-full rounded-2xl border-2 border-slate-700 bg-slate-900 px-4 py-3 text-center text-lg font-semibold text-strong outline-none focus:border-teal-300"
        />
        <p className="mt-2 text-xs text-slate-400">
          Up to {MAX_NAME_LENGTH} characters. Saved on this device only. Change
          it any time in Settings.
        </p>
        <button
          type="submit"
          className="mt-5 w-full rounded-2xl bg-teal-300 py-4 text-lg font-bold text-ink active:scale-[0.97]"
        >
          Continue
        </button>
        <button
          type="button"
          onClick={() => onDone('')}
          className="mt-2 rounded-xl px-4 py-2 text-sm font-semibold text-slate-400"
        >
          Skip
        </button>
      </form>
    </main>
  );
}
