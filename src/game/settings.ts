export type ColorMode = 'multi' | 'one';

export interface Settings {
  readonly colorMode: ColorMode;
  readonly sound: boolean;
  readonly lowPower: boolean;
}

/** Multi-color is the default (FR-37). */
export const defaultSettings = (): Settings => ({
  colorMode: 'multi',
  sound: true,
  lowPower: false,
});
