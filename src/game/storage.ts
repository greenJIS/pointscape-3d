import { isTrack, LEVELS_PER_TRACK, TRACK_COUNT } from '../core/difficulty';
import { cleanName } from './playerName';
import { emptyProgress, type Progress } from './progress';
import { defaultSettings, type Settings } from './settings';

export const STORAGE_KEY = 'pointscape-3d:v1';
/** Marks progress saved with one list of cleared levels per (difficulty, layers) track. */
const PROGRESS_VERSION = 2;

/** The part of `localStorage` we use, so tests can pass a fake (FR-39, FR-63). */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface SaveData {
  readonly progress: Progress;
  readonly settings: Settings;
  /** Empty until the player has been through the name screen. */
  readonly name: string;
}

export const emptySave = (): SaveData => ({
  progress: emptyProgress(),
  settings: defaultSettings(),
  name: '',
});

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isLevelList = (v: unknown): v is number[] =>
  Array.isArray(v) &&
  v.every((n) => Number.isInteger(n) && n >= 1 && n <= LEVELS_PER_TRACK);

/** Reads saved data defensively. Anything unreadable falls back to the default. */
export function parseSave(text: string | null): SaveData {
  const base = emptySave();
  if (text === null) return base;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return base;
  }
  if (!isRecord(raw)) return base;

  const p = isRecord(raw.progress) ? raw.progress : {};
  // Saves from before layers and difficulty were separate (no `v`) cannot be mapped onto the
  // 25 tracks, so their levels start over. Hints, name and settings carry across.
  const current = p.v === PROGRESS_VERSION;
  const clearedRaw = current && Array.isArray(p.cleared) ? p.cleared : [];
  const cleared = Array.from({ length: TRACK_COUNT }, (_, i) => {
    const list = clearedRaw[i];
    return isLevelList(list) ? [...new Set(list)].sort((a, b) => a - b) : [];
  });
  const last = current && isRecord(p.last) ? p.last : {};
  const lastD = typeof last.difficulty === 'number' ? last.difficulty : 0;
  const lastT = typeof last.layers === 'number' ? last.layers : 1;
  const lastL = typeof last.level === 'number' ? last.level : 1;
  const validLast =
    isTrack(lastD, lastT) &&
    Number.isInteger(lastL) &&
    lastL >= 1 &&
    lastL <= LEVELS_PER_TRACK;
  const progress: Progress = {
    cleared,
    hints:
      typeof p.hints === 'number' && Number.isInteger(p.hints) && p.hints >= 0
        ? p.hints
        : base.progress.hints,
    seenTutorial: p.seenTutorial === true,
    last: validLast
      ? { difficulty: lastD, layers: lastT, level: lastL }
      : base.progress.last,
  };

  const s = isRecord(raw.settings) ? raw.settings : {};
  const settings: Settings = {
    colorMode: s.colorMode === 'one' ? 'one' : 'multi',
    arrowSpeed:
      s.arrowSpeed === 'slow' || s.arrowSpeed === 'fast'
        ? s.arrowSpeed
        : 'normal',
    showLayers:
      typeof s.showLayers === 'boolean'
        ? s.showLayers
        : base.settings.showLayers,
    showDots:
      typeof s.showDots === 'boolean' ? s.showDots : base.settings.showDots,
    sound: typeof s.sound === 'boolean' ? s.sound : base.settings.sound,
    lowPower:
      typeof s.lowPower === 'boolean' ? s.lowPower : base.settings.lowPower,
  };

  const name = typeof raw.name === 'string' ? cleanName(raw.name) : '';
  return { progress, settings, name };
}

export const loadSave = (store: KeyValueStore): SaveData => {
  try {
    return parseSave(store.getItem(STORAGE_KEY));
  } catch {
    return emptySave();
  }
};

/** Returns false when the browser refuses to save, for example in private mode. */
export function writeSave(store: KeyValueStore, data: SaveData): boolean {
  try {
    const out = {
      ...data,
      progress: { ...data.progress, v: PROGRESS_VERSION },
    };
    store.setItem(STORAGE_KEY, JSON.stringify(out));
    return true;
  } catch {
    return false;
  }
}

/** Reset progress clears levels and hints but keeps the name (FR-67) and settings. */
export const resetProgress = (data: SaveData): SaveData => ({
  ...data,
  progress: emptyProgress(),
});
