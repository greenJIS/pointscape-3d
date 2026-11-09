import type { Vec3 } from './types';

export const v3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

export const add = (a: Vec3, b: Vec3): Vec3 =>
  v3(a.x + b.x, a.y + b.y, a.z + b.z);

export const sub = (a: Vec3, b: Vec3): Vec3 =>
  v3(a.x - b.x, a.y - b.y, a.z - b.z);

export const neg = (a: Vec3): Vec3 => v3(-a.x, -a.y, -a.z);

export const equal = (a: Vec3, b: Vec3): boolean =>
  a.x === b.x && a.y === b.y && a.z === b.z;

export const key = (a: Vec3): string => `${a.x},${a.y},${a.z}`;

export const UP = v3(0, -1, 0);
export const DOWN = v3(0, 1, 0);
export const LEFT = v3(-1, 0, 0);
export const RIGHT = v3(1, 0, 0);
/** Toward the viewer. */
export const FRONT = v3(0, 0, 1);
/** Away from the viewer. */
export const BACK = v3(0, 0, -1);

/** Directions inside one layer. One-layer boards use only these (FR-3). */
export const DIRS_PLANAR: readonly Vec3[] = [UP, DOWN, LEFT, RIGHT];

/** Boards with 2 or more layers add toward and away from the viewer (FR-3). */
export const DIRS_ALL: readonly Vec3[] = [...DIRS_PLANAR, FRONT, BACK];
