import type { ReactNode } from 'react';
import { useDialog } from './useDialog';

interface Props {
  readonly children: ReactNode;
  /** Called on Escape. Leave out for a card that must be answered with a button. */
  readonly onClose?: () => void;
}

/** One card, at most 384 px wide, centred on every screen size. */
export function Modal({ children, onClose }: Props) {
  const ref = useDialog(onClose);
  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-slate-950/80 p-6 backdrop-blur-sm">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="w-full max-w-sm rounded-3xl border border-slate-700 bg-slate-900 p-6 text-center shadow-2xl"
      >
        {children}
      </div>
    </div>
  );
}

interface ButtonProps {
  readonly label: string;
  readonly onClick: () => void;
  readonly primary?: boolean;
  readonly danger?: boolean;
}

export function ModalButton({ label, onClick, primary, danger }: ButtonProps) {
  const tone = primary
    ? 'bg-teal-300 text-ink'
    : danger
      ? 'bg-red-400 text-ink'
      : 'bg-slate-800 text-strong';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl py-3 font-bold active:scale-[0.97] ${tone}`}
    >
      {label}
    </button>
  );
}
