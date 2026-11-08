export type ColorMode = 'multi' | 'one';

export type ArrowSpeed = 'slow' | 'normal' | 'fast';

/** How much faster than the design demo each arrow speed plays the exit slide. */
export const ARROW_SPEED_RATE: Readonly<Record<ArrowSpeed, number>> = {
  slow: 0.6,
  normal: 1,
  fast: 1.6,
};

export interface Settings {
  readonly colorMode: ColorMode;
  readonly arrowSpeed: ArrowSpeed;
  /** See-through panel of each layer, and the grid dots on it. */
  readonly showLayers: boolean;
  readonly showDots: boolean;
  readonly sound: boolean;
  readonly lowPower: boolean;
}

/** Multi-color is the default (FR-37). */
export const defaultSettings = (): Settings => ({
  colorMode: 'multi',
  arrowSpeed: 'normal',
  showLayers: true,
  showDots: false,
  sound: true,
  lowPower: false,
});
