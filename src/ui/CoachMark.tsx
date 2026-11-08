interface Props {
  readonly onDone: () => void;
}

/**
 * First-time hint on Easy 1. A bottom card that sits below the board, so it never covers
 * an arrow. It is the only popup that can appear during a level.
 */
export function CoachMark({ onDone }: Props) {
  return (
    <div
      role="note"
      className="fixed inset-x-4 bottom-4 z-20 mx-auto max-w-md rounded-2xl border border-teal-300/40 bg-slate-900 p-4 shadow-2xl"
    >
      <p className="text-sm text-slate-200">
        Tap an arrow with a clear path in front of its head. Blocked arrows cost
        a heart.
      </p>
      <button
        type="button"
        onClick={onDone}
        className="mt-3 w-full rounded-xl bg-teal-300 py-2 font-bold text-slate-950 active:scale-[0.97]"
      >
        Got it
      </button>
    </div>
  );
}
