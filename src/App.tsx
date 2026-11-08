import { useCallback, useEffect, useRef, useState } from 'react';
import { createRng } from './core/rng';
import { LEVELS_PER_DIFFICULTY } from './core/difficulty';
import { unlockAllEnabled } from './game/dev';
import { cleanName, nameOrAnimal } from './game/playerName';
import {
  clearedCount,
  isDifficultyUnlocked,
  isUnlocked,
  markTutorialSeen,
  recordClear,
  spendHint,
  type ClearResult,
} from './game/progress';
import type { Settings } from './game/settings';
import {
  loadSave,
  resetProgress,
  writeSave,
  type SaveData,
} from './game/storage';
import { DifficultyScreen } from './ui/DifficultyScreen';
import { GameScreen } from './ui/GameScreen';
import { HomeScreen } from './ui/HomeScreen';
import { HowToPlayScreen } from './ui/HowToPlayScreen';
import { LevelsScreen } from './ui/LevelsScreen';
import { NameScreen } from './ui/NameScreen';
import { SettingsScreen } from './ui/SettingsScreen';

type Screen =
  | { readonly name: 'name' }
  | { readonly name: 'home' }
  | { readonly name: 'difficulty' }
  | { readonly name: 'levels'; readonly difficulty: number }
  | {
      readonly name: 'game';
      readonly difficulty: number;
      readonly level: number;
    };

const TOAST_MS = 2200;

export default function App() {
  const [save, setSave] = useState<SaveData>(() => loadSave(localStorage));
  const [screen, setScreen] = useState<Screen>(() =>
    save.name ? { name: 'home' } : { name: 'name' },
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  // Developer unlock-all (FR-26). Never saved, so it cannot leak into real progress (FR-27).
  const devAvailable = unlockAllEnabled();
  const [devOn, setDevOn] = useState(devAvailable);
  const unlockAll = devAvailable && devOn;
  const [toast, setToast] = useState<string | null>(null);
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
    writeSave(localStorage, save);
  }, [save]);

  useEffect(() => {
    if (toast === null) return;
    const t = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(t);
  }, [toast]);

  const { progress } = save;

  const play = useCallback(
    (difficulty: number, level: number) => {
      if (!isUnlocked(difficulty, level, saveRef.current.progress, unlockAll)) {
        return;
      }
      setScreen({ name: 'game', difficulty, level });
    },
    [unlockAll],
  );

  const onWin = useCallback(
    (difficulty: number, level: number): ClearResult => {
      const result = recordClear(saveRef.current.progress, difficulty, level);
      saveRef.current = { ...saveRef.current, progress: result.progress };
      setSave(saveRef.current);
      return result;
    },
    [],
  );

  const onHintUsed = useCallback(() => {
    const next = spendHint(saveRef.current.progress);
    if (!next) return;
    saveRef.current = { ...saveRef.current, progress: next };
    setSave(saveRef.current);
  }, []);

  const onCoachDone = useCallback(() => {
    saveRef.current = {
      ...saveRef.current,
      progress: markTutorialSeen(saveRef.current.progress),
    };
    setSave(saveRef.current);
  }, []);

  const setName = (raw: string, fillAnimal: boolean) =>
    setSave((s) => ({
      ...s,
      name: fillAnimal
        ? nameOrAnimal(raw, createRng(Date.now()))
        : cleanName(raw) || s.name,
    }));

  const setSettings = (settings: Settings) =>
    setSave((s) => ({ ...s, settings }));

  let body;
  switch (screen.name) {
    case 'name':
      body = (
        <NameScreen
          onDone={(raw) => {
            setName(raw, true);
            setScreen({ name: 'home' });
          }}
        />
      );
      break;
    case 'home':
      body = (
        <HomeScreen
          name={save.name}
          progress={progress}
          onPlay={() => play(progress.last.difficulty, progress.last.level)}
          onAllLevels={() => setScreen({ name: 'difficulty' })}
          onSettings={() => setSettingsOpen(true)}
          onHelp={() => setHelpOpen(true)}
        />
      );
      break;
    case 'difficulty':
      body = (
        <DifficultyScreen
          progress={progress}
          unlockAll={unlockAll}
          onPick={(difficulty) => setScreen({ name: 'levels', difficulty })}
          onLocked={setToast}
          onBack={() => setScreen({ name: 'home' })}
        />
      );
      break;
    case 'levels':
      body = (
        <LevelsScreen
          difficulty={screen.difficulty}
          progress={progress}
          unlockAll={unlockAll}
          onPickDifficulty={(difficulty) =>
            setScreen({ name: 'levels', difficulty })
          }
          onPlay={play}
          onLocked={setToast}
          onBack={() => setScreen({ name: 'difficulty' })}
        />
      );
      break;
    case 'game': {
      const { difficulty, level } = screen;
      body = (
        <GameScreen
          key={`${difficulty}:${level}`}
          difficulty={difficulty}
          level={level}
          hints={progress.hints}
          colorMode={save.settings.colorMode}
          lowPower={save.settings.lowPower}
          sound={save.settings.sound}
          clearedInDifficulty={clearedCount(progress, difficulty)}
          nextUnlocked={isDifficultyUnlocked(difficulty + 1, progress, false)}
          onHintUsed={onHintUsed}
          onWin={() => onWin(difficulty, level)}
          onNext={() =>
            setScreen({
              name: 'game',
              difficulty,
              level: Math.min(level + 1, LEVELS_PER_DIFFICULTY),
            })
          }
          onLevels={() => setScreen({ name: 'levels', difficulty })}
          showCoach={difficulty === 0 && level === 1 && !progress.seenTutorial}
          onCoachDone={onCoachDone}
          onSettings={() => setSettingsOpen(true)}
          onHelp={() => setHelpOpen(true)}
          onHome={() => setScreen({ name: 'home' })}
        />
      );
      break;
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {body}
      {settingsOpen && (
        <SettingsScreen
          name={save.name}
          settings={save.settings}
          dev={
            devAvailable
              ? { on: devOn, toggle: () => setDevOn((v) => !v) }
              : null
          }
          onName={(name) => setName(name, false)}
          onSettings={setSettings}
          onReset={() => {
            setSave((s) => resetProgress(s));
            setScreen({ name: 'home' });
          }}
          onBack={() => setSettingsOpen(false)}
        />
      )}
      {helpOpen && <HowToPlayScreen onBack={() => setHelpOpen(false)} />}
      {unlockAll && (
        <span className="fixed top-2 left-1/2 z-40 -translate-x-1/2 rounded-full bg-amber-400 px-3 py-0.5 text-xs font-bold text-slate-950">
          DEV: all unlocked
        </span>
      )}
      {toast !== null && (
        <div
          role="status"
          className="fixed top-12 left-1/2 z-40 -translate-x-1/2 rounded-full bg-teal-300 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
