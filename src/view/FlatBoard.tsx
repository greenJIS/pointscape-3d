import { useMemo } from 'react';
import { headOf } from '../core/board';
import type { Arrow, Level, Vec3 } from '../core/types';
import { arrowColors, BLOCKED } from './palette';

interface Props {
  readonly level: Level;
  readonly alive: ReadonlySet<number>;
  readonly oneColor: string | null;
  /** Arrow that just bumped something, drawn red for a moment. */
  readonly flashId: number | null;
  readonly hintId: number | null;
  /** Arrows sliding out right now, with their direction. */
  readonly leaving: ReadonlyMap<number, Arrow>;
  /** Body points to draw instead of an arrow's cells, for a slide driven from outside. */
  readonly shapes?: ReadonlyMap<number, readonly Vec3[]>;
  readonly onTap: (arrowId: number) => void;
}

/** Each layer is nudged so stacked layers stay visible. Temporary until the 3D view. */
const LAYER_SHIFT = 0.28;

/** Darker edge of an arrow, from its own colour. */
const EDGE = 'color-mix(in srgb, currentColor 45%, black)';

const pt = (arrow: Arrow, i: number): string => {
  const c = arrow.cells[i];
  if (!c) return '';
  return `${c.x + 0.5 + c.z * LAYER_SHIFT},${c.y + 0.5 - c.z * LAYER_SHIFT}`;
};

function Head({ arrow }: { readonly arrow: Arrow }) {
  const last = headOf(arrow);
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
        className="stroke-glint"
        strokeWidth={0.1}
      />
    );
  }
  const { x: dx, y: dy } = arrow.dir;
  const tip = `${cx + dx * 0.45},${cy + dy * 0.45}`;
  const a = `${cx - dx * 0.03 - dy * 0.36},${cy - dy * 0.03 + dx * 0.36}`;
  const notch = `${cx + dx * 0.09},${cy + dy * 0.09}`;
  const b = `${cx - dx * 0.03 + dy * 0.36},${cy - dy * 0.03 - dx * 0.36}`;
  return (
    <polygon
      points={`${tip} ${a} ${notch} ${b}`}
      fill="currentColor"
      stroke={EDGE}
      strokeWidth={0.04}
      strokeLinejoin="round"
    />
  );
}

export function FlatBoard({
  level,
  alive,
  oneColor,
  flashId,
  hintId,
  leaving,
  shapes,
  onTap,
}: Props) {
  const colors = useMemo(() => arrowColors(level), [level]);
  const shown = [...level.arrows]
    .filter((a) => alive.has(a.id) || leaving.has(a.id))
    .sort((a, b) => (a.cells[0]?.z ?? 0) - (b.cells[0]?.z ?? 0));
  const extra = (level.layers - 1) * LAYER_SHIFT;

  return (
    <svg
      viewBox={`-0.2 ${-extra - 0.2} ${level.width + extra + 0.4} ${level.height + extra + 0.4}`}
      className="size-full touch-none bg-slate-800"
      role="group"
      aria-label="Game board"
    >
      {Array.from({ length: level.width * level.height }, (_, i) => (
        <circle
          key={i}
          cx={(i % level.width) + 0.5}
          cy={Math.floor(i / level.width) + 0.5}
          r={0.07}
          className="fill-slate-600"
        />
      ))}
      {shown.map((full) => {
        const cells = shapes?.get(full.id);
        const arrow = cells ? { ...full, cells } : full;
        const out = leaving.get(arrow.id);
        const color =
          flashId === arrow.id
            ? BLOCKED
            : (oneColor ?? colors.get(arrow.id) ?? '#ffffff');
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
            <g transform="translate(0.06 0.1)" opacity={0.35}>
              <polyline
                points={points}
                fill="none"
                className="stroke-shade"
                strokeWidth={0.3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
            <polyline
              points={points}
              fill="none"
              stroke={EDGE}
              strokeWidth={0.3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points={points}
              fill="none"
              stroke="currentColor"
              strokeWidth={0.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <g transform="translate(-0.04 -0.04)" opacity={0.55}>
              <polyline
                points={points}
                fill="none"
                className="stroke-glint"
                strokeWidth={0.05}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
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
