import { useDialog } from './useDialog';
import type { ReactNode } from 'react';
import { BackIcon } from './icons';

interface Props {
  readonly title: string;
  readonly onBack: () => void;
  /** Cover the screen above the page behind it, for Settings and How to play. */
  readonly overlay?: boolean;
  /** Pinned under the header, for tabs and progress. */
  readonly top?: ReactNode;
  /** Pinned to the bottom. */
  readonly footer?: ReactNode;
  /** The only part that scrolls. */
  readonly children: ReactNode;
  /** Classes for the scrolling part, such as a grid. */
  readonly bodyClass?: string;
  /** Tailwind max-width class for the column. */
  readonly width?: string;
}

/**
 * The frame of every page that is not Home, the welcome screen or the board: a pinned header,
 * an optional pinned strip and footer, and a middle that scrolls over the dot grid.
 */
export function Page({
  title,
  onBack,
  overlay,
  top,
  footer,
  children,
  bodyClass = 'flex flex-col gap-4',
  width = 'max-w-4xl',
}: Props) {
  // Settings and How to play sit over another screen, so they behave as dialogs.
  const ref = useDialog(overlay ? onBack : undefined);
  return (
    <div
      ref={overlay ? ref : undefined}
      {...(overlay
        ? {
            role: 'dialog',
            'aria-modal': true,
            'aria-label': title,
            tabIndex: -1,
          }
        : {})}
      className={`flex h-dvh flex-col bg-slate-950 bg-[radial-gradient(circle,var(--color-slate-700)_1.6px,transparent_1.8px)] bg-size-[44px_44px] ${overlay ? 'fixed inset-0 z-20' : ''}`}
    >
      <header
        className={`mx-auto flex w-full ${width} shrink-0 items-center gap-3 p-5 pb-3`}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="grid size-11 place-items-center rounded-full hud-card"
        >
          <BackIcon />
        </button>
        <h1 className="text-2xl font-extrabold text-strong">{title}</h1>
      </header>
      {top && (
        <div
          className={`mx-auto flex w-full ${width} shrink-0 flex-col gap-3 px-5 pb-3`}
        >
          {top}
        </div>
      )}
      <main
        className={`mx-auto min-h-0 scroll-game w-full flex-1 overflow-y-auto mask-[linear-gradient(to_bottom,transparent,#000_0.5rem,#000_calc(100%-1.75rem),transparent)] ${width}`}
      >
        <div
          className={`px-5 pt-3 pb-[max(2.5rem,env(safe-area-inset-bottom))] ${bodyClass}`}
        >
          {children}
        </div>
      </main>
      {footer && (
        <footer
          className={`mx-auto flex w-full ${width} shrink-0 flex-col gap-3 p-5 pt-3`}
        >
          {footer}
        </footer>
      )}
    </div>
  );
}
