import { POOL } from '../view/palette';
import { Page } from './Page';

interface Props {
  readonly onBack: () => void;
}

const DOT = 'fill-slate-600';

/** One arrow as a line with a small head, in board cells (4 wide, 2 high). */
function Arrow({
  x,
  y,
  length,
  color,
}: {
  readonly x: number;
  readonly y: number;
  readonly length: number;
  readonly color: string;
}) {
  const tip = x + length;
  return (
    <g>
      <line
        x1={x}
        y1={y}
        x2={tip - 0.2}
        y2={y}
        stroke={color}
        strokeWidth={0.3}
        strokeLinecap="round"
      />
      <polygon
        points={`${tip + 0.3},${y} ${tip - 0.15},${y - 0.3} ${tip - 0.15},${y + 0.3}`}
        fill={color}
      />
    </g>
  );
}

function Mini({ children }: { readonly children: React.ReactNode }) {
  return (
    <svg
      viewBox="-0.2 -0.2 5.4 3.4"
      aria-hidden="true"
      className="w-full rounded-xl bg-slate-950"
    >
      {Array.from({ length: 12 }, (_, i) => (
        <circle
          key={i}
          cx={(i % 4) * 1.3 + 0.5}
          cy={Math.floor(i / 4) * 1.3 + 0.3}
          r={0.06}
          className={DOT}
        />
      ))}
      {children}
    </svg>
  );
}

function Ray({
  from,
  to,
  color,
}: {
  readonly from: number;
  readonly to: number;
  readonly color: string;
}) {
  return (
    <line
      x1={from}
      y1={1.6}
      x2={to}
      y2={1.6}
      stroke={color}
      strokeWidth={0.12}
      strokeDasharray="0.25 0.2"
    />
  );
}

const CARDS: readonly {
  readonly title: string;
  readonly text: string;
  readonly picture: React.ReactNode;
}[] = [
  {
    title: 'Find a clear path',
    text: 'Look in front of the arrow head. If nothing is in the way, tap it and it slides out.',
    picture: (
      <Mini>
        <Arrow x={0.4} y={1.6} length={2} color={POOL[2] ?? '#fff'} />
        <Ray from={2.9} to={5} color="#4ade80" />
      </Mini>
    ),
  },
  {
    title: 'Avoid blockers',
    text: 'Another arrow in the way stops it. A blocked tap costs a heart, once per arrow.',
    picture: (
      <Mini>
        <Arrow x={0.4} y={1.6} length={1.6} color={POOL[0] ?? '#fff'} />
        <Ray from={2.6} to={3.2} color="#f87171" />
        <rect
          x={3.2}
          y={1.2}
          width={0.5}
          height={0.8}
          rx={0.15}
          fill={POOL[4] ?? '#fff'}
        />
      </Mini>
    ),
  },
  {
    title: 'Clear the board',
    text: 'Remove every arrow before you run out of hearts. Bigger boards give you more.',
    picture: (
      <Mini>
        <Arrow x={1.6} y={1.6} length={1.4} color={POOL[1] ?? '#fff'} />
      </Mini>
    ),
  },
];

const TIPS: readonly string[] = [
  'Hold an arrow to preview its path.',
  'Drag to tilt the board. Pinch or scroll to zoom.',
  'On boards with 2 or more layers, arrows sit on stacked layers. Use the layer controls to see the ones behind.',
];

export function HowToPlayScreen({ onBack }: Props) {
  return (
    <Page title="How to play" onBack={onBack} overlay>
      <div className="grid gap-4 sm:grid-cols-3">
        {CARDS.map((c, i) => (
          <section key={c.title} className="rounded-3xl p-4 hud-card">
            {c.picture}
            <h2 className="mt-3 font-bold text-strong">
              {i + 1}. {c.title}
            </h2>
            <p className="mt-1 text-sm text-slate-400">{c.text}</p>
          </section>
        ))}
      </div>
      <ul className="list-disc rounded-3xl py-4 pr-4 pl-8 text-sm hud-card">
        {TIPS.map((t) => (
          <li key={t} className="py-0.5">
            {t}
          </li>
        ))}
      </ul>
    </Page>
  );
}
