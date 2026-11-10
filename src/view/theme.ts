/** Reads a colour or number from the CSS scheme in `index.css`. Empty if the file is not loaded. */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

/** The scene colours of the current theme, read from `--scene-*` in `index.css`. */
export interface Look {
  /** Backdrop that the dots fade into. */
  readonly board: string;
  readonly plate: string;
  /** See-through strength of a layer plate. */
  readonly layer: number;
  readonly dot: string;
  readonly sky: string;
  /** Cool light from behind the board. */
  readonly rim: string;
  readonly ok: string;
  /** Colour of the drop shadows. */
  readonly shade: string;
}

export function readLook(): Look {
  return {
    board: cssVar('--scene-board'),
    plate: cssVar('--scene-plate'),
    layer: Number(cssVar('--scene-layer')),
    dot: cssVar('--scene-dot'),
    sky: cssVar('--scene-sky'),
    rim: cssVar('--scene-rim'),
    ok: cssVar('--color-ok'),
    shade: cssVar('--color-shade'),
  };
}
