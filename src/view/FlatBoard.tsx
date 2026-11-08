import type { Arrow, Level } from '../core/types';
import { colorFor, BLOCKED } from './palette';

interface Props {
  readonly level: Level;
  readonly alive: ReadonlySet<number>;
  readonly oneColor: string | null;
  /** Arrow that just bumped something, drawn red for a moment. */
  readonly flashId: number | null;
  readonly hintId: number | null;
  /** Arrows sliding out right now, with their direction. */
  readonly leaving: ReadonlyMap<number, Arrow>;
  readonly onTap: (arrowId: number) => void;
}

/** Each layer is nudged so stacked layers stay visible. Temporary until the 3D view. */
const LAYER_SHIFT = 0.28;

const pt = (arrow: Arrow, i: number): string => {
  const c = arrow.cells[i];
  if (!c) return '';
  return `${c.x + 0.5 + c.z * LAYER_SHIFT},${c.y + 0.5 - c.z * LAYER_SHIFT}`;
};

function Head({ arrow }: { readonly arrow: Arrow }) {
  const last = arrow.cells[arrow.cells.length - 1];
  if (!last) return null;
  const cx = last.x + 0.5 + last.z * LAYER_SHIFT;
  const cy = last.y + 0.5 - last.z * LAYER_SHIFT;
  // Heads that point along z are drawn as a ring, since the flat view has no depth.
  if (arrow.dir.z !== 0) {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={0.38}
        fill="none"
        stroke="#fff"
        strokeWidth={0.1}
      />
    );
  }
  const { x: dx, y: dy } = arrow.dir;
  const tip = `${cx + dx * 0.62},${cy + dy * 0.62}`;
  const a = `${cx - dx * 0.05 - dy * 0.42},${cy - dy * 0.05 + dx * 0.42}`;
  const notch = `${cx - dx * 0.2},${cy - dy * 0.2}`;
  const b = `${cx - dx * 0.05 + dy * 0.42},${cy - dy * 0.05 - dx * 0.42}`;
  return <polygon points={`${tip} ${a} ${notch} ${b}`} fill="currentColor" />;
}

export function FlatBoard({
  level,
  alive,
  oneColor,
  flashId,
  hintId,
  leaving,
  onTap,
}: Props) {
  const shown = [...level.arrows]
    .filter((a) => alive.has(a.id) || leaving.has(a.id))
    .sort((a, b) => (a.cells[0]?.z ?? 0) - (b.cells[0]?.z ?? 0));
  const extra = (level.layers - 1) * LAYER_SHIFT;

  return (
    <svg
      viewBox={`-0.2 ${-extra - 0.2} ${level.width + extra + 0.4} ${level.height + extra + 0.4}`}
      className="aspect-square w-full touch-none rounded-2xl bg-plate"
      role="group"
      aria-label="Game board"
    >
      {Array.from({ length: level.width * level.height }, (_, i) => (
        <circle
          key={i}
          cx={(i % level.width) + 0.5}
          cy={Math.floor(i / level.width) + 0.5}
          r={0.05}
          className="fill-slate-600"
        />
      ))}
      {shown.map((arrow) => {
        const out = leaving.get(arrow.id);
        const color =
          flashId === arrow.id ? BLOCKED : colorFor(arrow.id, oneColor);
        const points = arrow.cells.map((_, i) => pt(arrow, i)).join(' ');
        return (
          <g
            key={arrow.id}
            data-arrow-id={arrow.id}
            style={{
              color,
              transform: out
                ? `translate(${out.dir.x * level.width}px, ${out.dir.y * level.height}px)`
                : undefined,
              transition: out
                ? 'transform 320ms ease-in, opacity 320ms'
                : undefined,
              opacity: out ? 0 : 1,
            }}
            className={hintId === arrow.id ? 'animate-pulse' : undefined}
          >
            <polyline
              points={points}
              fill="none"
              stroke="currentColor"
              strokeWidth={0.3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Head arrow={arrow} />
            <polyline
              points={points}
              fill="none"
              stroke="transparent"
              strokeWidth={0.9}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="cursor-pointer"
              onClick={() => onTap(arrow.id)}
            />
          </g>
        );
      })}
    </svg>
  );
}
