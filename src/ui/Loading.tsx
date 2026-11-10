import { useEffect, useState, type CSSProperties } from 'react';
import { POOL } from '../view/palette';
import { Logo } from './Logo';

interface Props {
  readonly label?: string;
  /** Second line under the label, for example the track and level. */
  readonly detail?: string;
  /** Cover the whole screen above everything else, for a board that is still drawing. */
  readonly overlay?: boolean;
}

const CELL = 56;
const COLS = 6;
const ROWS = 4;
const HEAD = 20;
const TIPS: readonly string[] = [
  'Look in front of the arrow head. If nothing is in the way, tap it.',
  'A blocked tap costs a heart, once per arrow.',
  'There is no undo, so look before you tap.',
  'Bigger boards give you more hearts.',
  'Clear every arrow to win the level.',
  'Clearing 10 levels opens the next level set.',
];
const TIP_MS = 3500;

interface Mover {
  readonly color: string;
  /** Tail and tip, in board units. The line is drawn from the tail to the head base. */
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
  /** How far it slides to leave the board. */
  readonly out: readonly [number, number];
}

const centre = (n: number): number => CELL / 2 + CELL * n;
/** Listed in exit order: each arrow leaves a clear path for the next one, as in the game. */
const MOVERS: readonly Mover[] = [
  {
    color: POOL[2] ?? '#fff',
    from: [centre(0), centre(0)],
    to: [centre(2) + 10, centre(0)],
    out: [420, 0],
  },
  {
    color: POOL[1] ?? '#fff',
    from: [centre(0), centre(3)],
    to: [centre(0), centre(1) + 10],
    out: [0, -300],
  },
  {
    color: POOL[0] ?? '#fff',
    from: [centre(2), centre(2) + 24],
    to: [centre(2), centre(1) - 8],
    out: [0, -300],
  },
  {
    color: POOL[4] ?? '#fff',
    from: [centre(5), centre(1)],
    to: [centre(3) - 6, centre(1)],
    out: [-420, 0],
  },
  {
    color: POOL[2] ?? '#fff',
    from: [centre(5), centre(3)],
    to: [centre(5), centre(2) - 6],
    out: [0, -300],
  },
  {
    color: POOL[3] ?? '#fff',
    from: [centre(1), centre(3)],
    to: [centre(3) + 28, centre(3)],
    out: [420, 0],
  },
];

interface Drawn {
  readonly color: string;
  readonly line: readonly [number, number, number, number];
  readonly head: string;
  readonly style: CSSProperties;
}

/** Each arrow as a round line with a barbed head, like the ones on the board. Worked out once. */
const DRAWN: readonly Drawn[] = MOVERS.map((m, i) => {
  const [x1, y1] = m.from;
  const [x2, y2] = m.to;
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  const bx = x2 - ux * HEAD;
  const by = y2 - uy * HEAD;
  return {
    color: m.color,
    line: [x1, y1, bx, by],
    head: `${x2},${y2} ${bx - uy * 13},${by + ux * 13} ${bx + uy * 13},${by - ux * 13}`,
    style: {
      ['--dx' as string]: `${m.out[0]}px`,
      ['--dy' as string]: `${m.out[1]}px`,
      animationDelay: `${i * 0.5}s`,
    },
  };
});

/** The small board: dots, and arrows that slide away and come back. */
function Board() {
  return (
    <div
      aria-hidden="true"
      className="w-full max-w-84 overflow-hidden rounded-3xl border border-slate-600 bg-slate-800 shadow-[0_2px_0_var(--color-slate-600),0_12px_26px_rgb(0_0_0/0.35)]"
    >
      <svg
        viewBox={`0 0 ${CELL * COLS} ${CELL * ROWS}`}
        className="block w-full"
      >
        {Array.from({ length: COLS * ROWS }, (_, i) => (
          <circle
            key={i}
            cx={centre(i % COLS)}
            cy={centre(Math.floor(i / COLS))}
            r={2.6}
            className="fill-slate-600"
          />
        ))}
        <g className="drop-shadow-[3px_4px_0_rgb(0_0_0/0.3)]">
          {DRAWN.map((d, i) => (
            <g key={i} className="load-arrow" style={d.style}>
              <line
                x1={d.line[0]}
                y1={d.line[1]}
                x2={d.line[2]}
                y2={d.line[3]}
                stroke={d.color}
                strokeWidth={14}
                strokeLinecap="round"
              />
              <polygon points={d.head} fill={d.color} />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}

/** Own state, so a new tip does not redraw the board. */
function Tip() {
  const [tip, setTip] = useState(() => Math.floor(Math.random() * TIPS.length));
  useEffect(() => {
    const t = window.setInterval(
      () => setTip((i) => (i + 1) % TIPS.length),
      TIP_MS,
    );
    return () => window.clearInterval(t);
  }, []);
  return (
    <p
      key={tip}
      className="min-h-12 max-w-sm load-tip text-center text-base text-slate-300"
    >
      {TIPS[tip]}
    </p>
  );
}

/** The loading screen: the logo, a small board where arrows slide away and return, and a tip. */
export function Loading({ label = 'Loading', detail, overlay = false }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`grid place-items-center overflow-hidden bg-slate-950 bg-[radial-gradient(circle,var(--color-slate-800)_1.6px,transparent_1.8px)] bg-size-[44px_44px] ${overlay ? 'absolute inset-0 z-30' : 'h-dvh'}`}
    >
      <div className="flex w-full max-w-md flex-col items-center gap-5 px-5">
        <Logo className="text-3xl" />
        <Board />
        <div className="text-center">
          <p className="text-xl font-extrabold text-strong">{label}</p>
          {detail && (
            <p className="mt-1 text-base font-semibold text-slate-300">
              {detail}
            </p>
          )}
        </div>
        <div
          aria-hidden="true"
          className="h-2.5 w-65 overflow-hidden rounded-full border border-slate-600 bg-slate-900"
        >
          <i className="block h-full w-2/5 load-bar rounded-full" />
        </div>
        <Tip />
      </div>
    </div>
  );
}
