import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { Loading } from './Loading';

// three.js comes in a separate file, and only once the page has settled.
const HomeBackdrop = lazy(() =>
  import('./HomeBackdrop').then((m) => ({ default: m.HomeBackdrop })),
);

const MIN_LOADING_MS = 500;
/** Matches `duration-300` on the overlay. */
const FADE_MS = 300;

/** True once the browser is idle, so the heavy backdrop never delays the first paint. */
function useIdle(): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(() => setIdle(true), { timeout: 800 });
      return () => cancelIdleCallback(id);
    }
    const id = window.setTimeout(() => setIdle(true), 200);
    return () => window.clearTimeout(id);
  }, []);
  return idle;
}

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
  const idle = useIdle();
  const [drawn, setDrawn] = useState(false);
  const [waited, setWaited] = useState(false);
  // Show the loading card for a moment at least, so it never flashes.
  useEffect(() => {
    const id = window.setTimeout(() => setWaited(true), MIN_LOADING_MS);
    return () => window.clearTimeout(id);
  }, []);
  const ready = drawn && waited;
  // Drop the overlay once it has faded, so its animations stop running behind Home.
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (!ready) return;
    const id = window.setTimeout(() => setGone(true), FADE_MS);
    return () => window.clearTimeout(id);
  }, [ready]);
  return (
    <main className="relative h-dvh overflow-hidden bg-[radial-gradient(ellipse_at_50%_40%,var(--color-slate-900)_0%,var(--color-slate-800)_100%)]">
      {idle && (
        <Suspense fallback={null}>
          <HomeBackdrop
            dark={dark}
            lowPower={lowPower}
            onReady={() => setDrawn(true)}
          />
        </Suspense>
      )}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_34%_48%_at_50%_46%,color-mix(in_srgb,var(--color-slate-800)_92%,transparent)_0%,color-mix(in_srgb,var(--color-slate-800)_70%,transparent)_55%,transparent_100%)]" />
      {children}
      {!gone && (
        <div
          aria-hidden={ready}
          className={`absolute inset-0 z-30 transition-opacity duration-300 ${ready ? 'pointer-events-none opacity-0' : ''}`}
        >
          <Loading label="Loading" />
        </div>
      )}
    </main>
  );
}
