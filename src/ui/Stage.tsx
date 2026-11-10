import type { ReactNode } from 'react';
import { HomeBackdrop } from './HomeBackdrop';

/** Full-page stage for Home and the name screen: sliding arrows with a soft veil behind the text. */
export function Stage({
  dark,
  lowPower,
  children,
}: {
  readonly dark: boolean;
  readonly lowPower: boolean;
  readonly children: ReactNode;
}) {
  return (
    <main className="relative h-dvh overflow-hidden bg-[radial-gradient(ellipse_at_50%_40%,var(--color-slate-900)_0%,var(--color-slate-800)_100%)]">
      <HomeBackdrop dark={dark} lowPower={lowPower} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_34%_48%_at_50%_46%,color-mix(in_srgb,var(--color-slate-800)_92%,transparent)_0%,color-mix(in_srgb,var(--color-slate-800)_70%,transparent)_55%,transparent_100%)]" />
      {children}
    </main>
  );
}
