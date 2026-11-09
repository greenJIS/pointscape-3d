import { useState } from 'react';
import { MAX_NAME_LENGTH, cleanName } from '../game/playerName';
import type { ArrowSpeed, ColorMode, Settings } from '../game/settings';
import { POOL } from '../view/palette';
import { Modal, ModalButton } from './Modal';

interface Props {
  readonly name: string;
  readonly settings: Settings;
  /** Present only when the developer switch exists in this build (FR-26). */
  readonly dev: { readonly on: boolean; readonly toggle: () => void } | null;
  readonly onName: (name: string) => void;
  readonly onSettings: (settings: Settings) => void;
  readonly onReset: () => void;
  readonly onBack: () => void;
}

function Switch({
  label,
  on,
  onChange,
}: {
  readonly label: string;
  readonly on: boolean;
  readonly onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onChange}
      className="flex w-full items-center justify-between py-1"
    >
      <span>{label}</span>
      <span
        className={`flex h-6 w-11 items-center rounded-full p-0.5 ${on ? 'justify-end bg-teal-300' : 'justify-start bg-slate-700'}`}
      >
        <span className="size-5 rounded-full bg-white" />
      </span>
    </button>
  );
}

const SPEEDS: readonly { id: ArrowSpeed; label: string }[] = [
  { id: 'slow', label: 'Slow' },
  { id: 'normal', label: 'Normal' },
  { id: 'fast', label: 'Fast' },
];

const MODES: readonly { id: ColorMode; label: string; hint: string }[] = [
  { id: 'multi', label: 'Multi-color', hint: 'All five colours' },
  { id: 'one', label: 'One-color', hint: 'One colour you pick' },
];

export function SettingsScreen({
  name,
  settings,
  dev,
  onName,
  onSettings,
  onReset,
  onBack,
}: Props) {
  const [draft, setDraft] = useState(name);
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="fixed inset-0 z-20 overflow-y-auto bg-slate-950">
      <main className="mx-auto flex max-w-3xl flex-col gap-4 p-5">
        <header className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="grid size-11 place-items-center rounded-full bg-slate-800"
          >
            ←
          </button>
          <h1 className="text-xl font-bold text-white">Settings</h1>
        </header>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl bg-slate-900 p-4">
            <label
              htmlFor="player-name"
              className="mb-2 block font-semibold text-white"
            >
              Player name
            </label>
            <input
              id="player-name"
              value={draft}
              maxLength={MAX_NAME_LENGTH}
              autoComplete="off"
              onChange={(e) => {
                setDraft(e.target.value);
                const next = cleanName(e.target.value);
                if (next) onName(next);
              }}
              onBlur={() => setDraft(name)}
              className="w-full rounded-xl border-2 border-slate-700 bg-slate-950 px-3 py-2 font-semibold text-white outline-none focus:border-teal-300"
            />
            <p className="mt-2 text-xs text-slate-500">
              Saved as you type. Reset progress does not change it.
            </p>
          </section>

          <section className="rounded-2xl bg-slate-900 p-4">
            <p className="mb-2 font-semibold text-white">Arrow colours</p>
            <div className="grid grid-cols-2 gap-2">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={settings.colorMode === m.id}
                  onClick={() => onSettings({ ...settings, colorMode: m.id })}
                  className={`rounded-xl border-2 p-3 text-left ${settings.colorMode === m.id ? 'border-teal-300 bg-slate-800' : 'border-slate-800 bg-slate-950'}`}
                >
                  <span className="block font-bold text-white">{m.label}</span>
                  <span className="block text-xs text-slate-400">{m.hint}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              {settings.colorMode === 'multi' ? (
                POOL.map((c) => (
                  <span
                    key={c}
                    className="size-8 rounded-full"
                    style={{ background: c }}
                  />
                ))
              ) : (
                <>
                  {POOL.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Use colour ${c}`}
                      aria-pressed={settings.oneColor === c}
                      onClick={() => onSettings({ ...settings, oneColor: c })}
                      className={`size-8 rounded-full border-2 ${settings.oneColor === c ? 'border-white' : 'border-transparent'}`}
                      style={{ background: c }}
                    />
                  ))}
                </>
              )}
            </div>
          </section>

          <section className="rounded-2xl bg-slate-900 p-4">
            <p className="mb-2 font-semibold text-white">Arrow speed</p>
            <div className="grid grid-cols-3 gap-2">
              {SPEEDS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={settings.arrowSpeed === s.id}
                  onClick={() => onSettings({ ...settings, arrowSpeed: s.id })}
                  className={`rounded-xl border-2 p-2 text-sm font-semibold ${settings.arrowSpeed === s.id ? 'border-teal-300 bg-slate-800' : 'border-slate-800 bg-slate-950'}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              How fast a tapped arrow slides off the board.
            </p>
          </section>

          <section className="rounded-2xl bg-slate-900 p-4">
            <Switch
              label="Show layers"
              on={settings.showLayers}
              onChange={() =>
                onSettings({ ...settings, showLayers: !settings.showLayers })
              }
            />
            <Switch
              label="Show grid dots"
              on={settings.showDots}
              onChange={() =>
                onSettings({ ...settings, showDots: !settings.showDots })
              }
            />
            <Switch
              label="Sound"
              on={settings.sound}
              onChange={() =>
                onSettings({ ...settings, sound: !settings.sound })
              }
            />
            <Switch
              label="Low power mode"
              on={settings.lowPower}
              onChange={() =>
                onSettings({ ...settings, lowPower: !settings.lowPower })
              }
            />
            <p className="mt-1 text-xs text-slate-500">
              Low power turns off shadows and soft effects for older phones.
            </p>
          </section>

          {dev && (
            <section className="rounded-2xl border border-amber-400/40 bg-slate-900 p-4">
              <p className="mb-1 flex items-center gap-2 font-semibold text-amber-300">
                <span className="rounded-sm bg-amber-400 px-1.5 text-xs font-bold text-slate-950">
                  DEV
                </span>
                Developer
              </p>
              <Switch
                label="Unlock all levels"
                on={dev.on}
                onChange={dev.toggle}
              />
            </section>
          )}
        </div>

        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-xl bg-red-500/15 py-3 font-semibold text-red-300"
        >
          Reset progress
        </button>
        <p className="pb-4 text-center text-xs text-slate-500">
          Pointscape 3D. The art and the levels are original.
        </p>
      </main>

      {confirming && (
        <Modal>
          <h2 className="text-xl font-bold text-white">Reset progress?</h2>
          <p className="mt-2 text-sm text-slate-400">
            All cleared levels and hints are removed. Your name and settings
            stay. This cannot be undone.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <ModalButton label="Cancel" onClick={() => setConfirming(false)} />
            <ModalButton
              label="Reset"
              danger
              onClick={() => {
                onReset();
                setConfirming(false);
              }}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
