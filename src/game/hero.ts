import type { Level } from '../core/types';
import { RIGHT, UP, v3 } from '../core/vec';

/** The small board on Home. Six arrows that leave one after another in a loop. */
export const HERO_LEVEL: Level = {
  width: 6,
  height: 6,
  layers: 1,
  arrows: [
    { id: 0, cells: [v3(4, 3, 0), v3(4, 2, 0), v3(4, 1, 0)], dir: UP },
    { id: 1, cells: [v3(0, 1, 0), v3(1, 1, 0), v3(2, 1, 0)], dir: RIGHT },
    { id: 2, cells: [v3(0, 4, 0), v3(1, 4, 0), v3(1, 3, 0)], dir: UP },
    {
      id: 3,
      cells: [v3(3, 5, 0), v3(4, 5, 0), v3(5, 5, 0), v3(5, 4, 0)],
      dir: UP,
    },
    { id: 4, cells: [v3(2, 4, 0), v3(3, 4, 0), v3(3, 3, 0)], dir: UP },
    { id: 5, cells: [v3(0, 0, 0), v3(1, 0, 0), v3(2, 0, 0)], dir: RIGHT },
  ],
};
