import { DIFFICULTIES } from './core/difficulty';

export default function App() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 p-6 text-slate-200">
      <div className="text-center">
        <h1 className="text-4xl font-black tracking-tight text-white">
          Pointscape <span className="text-teal-300">3D</span>
        </h1>
        <p className="mt-2 text-slate-400">
          Scaffold only. {DIFFICULTIES.length} difficulties, 100 levels each.
        </p>
      </div>
    </main>
  );
}
