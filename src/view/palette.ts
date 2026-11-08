/** The five arrow colours (FR-31). Same values as the `@theme` tokens in index.css. */
export const POOL: readonly string[] = [
  '#fb923c',
  '#facc15',
  '#2dd4bf',
  '#818cf8',
  '#e879f9',
];

export const BLOCKED = '#f87171';

/** Placeholder colouring until neighbour colouring lands (FR-36). */
export const colorFor = (arrowId: number, oneColor: string | null): string =>
  oneColor ?? POOL[arrowId % POOL.length] ?? '#ffffff';
