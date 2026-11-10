interface IconProps {
  readonly className?: string;
}

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

/** Line icons in the text colour, so they follow the theme and never turn into emoji. */
export function HelpIcon({ className = 'size-5' }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M9 9a3 3 0 1 1 4.6 2.5c-1 .6-1.6 1.2-1.6 2.5" />
      <path d="M12 17.5v.01" />
    </svg>
  );
}

export function SettingsIcon({ className = 'size-5' }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </svg>
  );
}

export function PauseIcon({ className = 'size-5' }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M9 6v12M15 6v12" />
    </svg>
  );
}
