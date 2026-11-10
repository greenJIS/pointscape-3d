import { useRef, useState, type ReactNode } from 'react';
import { MAX_NAME_LENGTH, cleanName } from '../game/playerName';
import type {
  ArrowSpeed,
  ColorMode,
  Settings,
  ThemeMode,
} from '../game/settings';
import { revealTheme } from '../game/useDark';
import { POOL } from '../view/palette';
import { MoonIcon, SunIcon } from './icons';
import { Modal, ModalButton } from './Modal';
import { Page } from './Page';

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
  hint,
  on,
  onChange,
}: {
  readonly label: string;
  readonly hint?: string;
  readonly on: boolean;
  readonly onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onChange}
      className="flex w-full items-center justify-between gap-4 py-2.5 text-left"
    >
      <span>
        {label}
        {hint && <small className="block text-xs text-slate-400">{hint}</small>}
      </span>
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full border-2 border-slate-700 transition-colors duration-200 ${on ? 'bg-teal-300' : 'bg-slate-950'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${on ? 'translate-x-5' : ''}`}
        />
      </span>
    </button>
  );
}

function Group({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-3xl p-4 hud-card">
      <h2 className="text-xs font-bold tracking-widest text-slate-400 uppercase">
        {title}
      </h2>
      {children}
    </section>
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
  const themeButton = useRef<HTMLButtonElement>(null);
  const dark = settings.theme === 'dark';
  const toggleTheme = () => {
    const next: ThemeMode = dark ? 'light' : 'dark';
    const apply = () => onSettings({ ...settings, theme: next });
    if (themeButton.current) revealTheme(themeButton.current, apply);
    else apply();
  };

  return (
    <>
      <Page
        title="Settings"
        onBack={onBack}
        overlay
        width="max-w-2xl"
        bodyClass="flex flex-col gap-5"
        footer={
          <>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="rounded-2xl bg-red-400 py-3 font-bold text-ink shadow-[0_4px_0_var(--color-danger-edge)]"
            >
              Reset progress
            </button>
            <p className="text-center text-xs text-slate-400">
              Pointscape 3D. The art and the levels are original.
            </p>
          </>
        }
      >
        <Group title="Player">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-11 place-items-center rounded-full bg-night font-bold text-link"
            >
              {draft.slice(0, 1).toUpperCase()}
            </span>
            <input
              id="player-name"
              aria-label="Player name"
              value={draft}
              maxLength={MAX_NAME_LENGTH}
              autoComplete="off"
              onChange={(e) => {
                setDraft(e.target.value);
                const next = cleanName(e.target.value);
                if (next) onName(next);
              }}
              onBlur={() => setDraft(name)}
              className="min-w-0 flex-1 rounded-xl border-2 border-slate-700 bg-slate-950 px-3 py-2 font-semibold text-strong outline-none focus:border-teal-300"
            />
          </div>
          <p className="-mt-2 text-xs text-slate-400">
            Saved as you type. Reset progress does not change it.
          </p>
        </Group>

        <Group title="Look">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-bold text-strong">Theme</p>
              <p className="text-xs text-slate-400">
                {dark ? 'Dark' : 'Light'}. Tap to switch.
              </p>
            </div>
            <button
              ref={themeButton}
              type="button"
              role="switch"
              aria-checked={dark}
              aria-label="Dark mode"
              onClick={toggleTheme}
              className="relative h-12 w-24 shrink-0 rounded-full border-2 border-slate-700 bg-slate-950"
            >
              <span className="absolute inset-0 flex items-center justify-between px-3 text-slate-400">
                <SunIcon className="size-4.5" />
                <MoonIcon className="size-4.5" />
              </span>
              <span
                className={`absolute top-1 left-1 grid size-9 place-items-center rounded-full bg-teal-300 text-ink shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.3,1.4,0.5,1)] ${dark ? 'translate-x-12' : ''}`}
              >
                {dark ? <MoonIcon /> : <SunIcon />}
              </span>
            </button>
          </div>

          <div>
            <p className="mb-2 font-bold text-strong">Arrow colours</p>
            <div className="mb-3 grid grid-cols-2 gap-2">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={settings.colorMode === m.id}
                  onClick={() => onSettings({ ...settings, colorMode: m.id })}
                  className={`rounded-xl border-2 p-3 text-left ${settings.colorMode === m.id ? 'border-teal-300 bg-slate-800' : 'border-slate-700 bg-slate-950'}`}
                >
                  <span className="block font-bold text-strong">{m.label}</span>
                  <span className="block text-xs text-slate-400">{m.hint}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              {POOL.map((c) =>
                settings.colorMode === 'multi' ? (
                  <span
                    key={c}
                    className="size-11 rounded-full"
                    style={{ background: c }}
                  />
                ) : (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Use colour ${c}`}
                    aria-pressed={settings.oneColor === c}
                    onClick={() => onSettings({ ...settings, oneColor: c })}
                    className={`size-11 rounded-full border-2 transition-transform ${settings.oneColor === c ? 'scale-110 border-strong' : 'border-transparent'}`}
                    style={{ background: c }}
                  />
                ),
              )}
            </div>
          </div>
        </Group>

        <Group title="Play">
          <div>
            <p className="mb-2 font-bold text-strong">Arrow speed</p>
            <div className="grid grid-cols-3 rounded-full border-2 border-slate-700 bg-slate-950 p-1 text-center text-sm font-semibold">
              {SPEEDS.map((sp) => (
                <button
                  key={sp.id}
                  type="button"
                  aria-pressed={settings.arrowSpeed === sp.id}
                  onClick={() => onSettings({ ...settings, arrowSpeed: sp.id })}
                  className={`rounded-full py-3 transition-colors ${settings.arrowSpeed === sp.id ? 'bg-teal-300 text-ink' : ''}`}
                >
                  {sp.label}
                </button>
              ))}
            </div>
          </div>
          <div className="divide-y divide-slate-700">
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
              hint="No shadows or soft effects, for older phones."
              on={settings.lowPower}
              onChange={() =>
                onSettings({ ...settings, lowPower: !settings.lowPower })
              }
            />
          </div>
        </Group>

        {dev && (
          <section className="rounded-3xl border border-amber-400/40 bg-slate-900 p-4">
            <p className="mb-1 flex w-fit items-center gap-2 rounded-full bg-night py-0.5 pr-3 pl-1 font-semibold text-caution">
              <span className="rounded-sm bg-amber-400 px-1.5 text-xs font-bold text-ink">
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
      </Page>

      {confirming && (
        <Modal onClose={() => setConfirming(false)}>
          <h2 className="text-xl font-bold text-strong">Reset progress?</h2>
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
    </>
  );
}
