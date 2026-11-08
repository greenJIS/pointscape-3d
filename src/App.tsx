import { useEffect, useState } from 'react';
import { LEVELS_PER_DIFFICULTY } from './core/difficulty';
import { recordClear, spendHint } from './game/progress';
import { loadSave, writeSave, type SaveData } from './game/storage';
import { GameScreen } from './ui/GameScreen';

interface Played {
  readonly difficulty: number;
  readonly level: number;
}

export default function App() {
  const [save, setSave] = useState<SaveData>(() => loadSave(localStorage));
  // The level on screen. It only moves on Next, so a win keeps its modal.
  const [playing, setPlaying] = useState<Played>(save.progress.last);

  useEffect(() => {
    writeSave(localStorage, save);
  }, [save]);

  const onWin = () =>
    setSave((s) => ({
      ...s,
      progress: recordClear(s.progress, playing.difficulty, playing.level)
        .progress,
    }));

  const onHintUsed = () =>
    setSave((s) => {
      const progress = spendHint(s.progress);
      return progress ? { ...s, progress } : s;
    });

  const onNext = () =>
    setPlaying((p) => ({
      difficulty: p.difficulty,
      level: Math.min(p.level + 1, LEVELS_PER_DIFFICULTY),
    }));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <GameScreen
        key={`${playing.difficulty}:${playing.level}`}
        difficulty={playing.difficulty}
        level={playing.level}
        hints={save.progress.hints}
        onHintUsed={onHintUsed}
        onWin={onWin}
        onNext={onNext}
      />
    </div>
  );
}
