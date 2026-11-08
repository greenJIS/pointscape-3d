/** Full class names, so Tailwind can see them. One accent per difficulty. */
export interface Accent {
  readonly bg: string;
  readonly text: string;
  readonly border: string;
}

export const ACCENTS: readonly Accent[] = [
  { bg: 'bg-teal-300', text: 'text-teal-300', border: 'border-teal-300' },
  { bg: 'bg-indigo-400', text: 'text-indigo-400', border: 'border-indigo-400' },
  {
    bg: 'bg-fuchsia-400',
    text: 'text-fuchsia-400',
    border: 'border-fuchsia-400',
  },
  { bg: 'bg-orange-400', text: 'text-orange-400', border: 'border-orange-400' },
  { bg: 'bg-yellow-400', text: 'text-yellow-400', border: 'border-yellow-400' },
];

export const accentFor = (difficulty: number): Accent =>
  ACCENTS[difficulty] ?? ACCENTS[0] ?? { bg: '', text: '', border: '' };
