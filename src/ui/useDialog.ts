import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Open dialogs, newest last. Only the newest answers Escape and Tab. */
const open: HTMLElement[] = [];

/**
 * Makes a container behave like a dialog: focus moves in when it opens and comes back when it
 * closes, Tab stays inside it, and Escape calls `onClose` (if there is one).
 */
export function useDialog(
  onClose?: () => void,
): RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    const before = document.activeElement;
    open.push(box);
    const items = () => [...box.querySelectorAll<HTMLElement>(FOCUSABLE)];
    (items()[0] ?? box).focus();

    const onKey = (e: KeyboardEvent) => {
      if (open[open.length - 1] !== box) return;
      if (e.key === 'Escape' && closeRef.current) {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = items();
      const first = list[0];
      const last = list[list.length - 1];
      if (!first || !last) {
        e.preventDefault();
        return;
      }
      const at = document.activeElement;
      if (e.shiftKey && (at === first || !box.contains(at))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (at === last || !box.contains(at))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      open.splice(open.indexOf(box), 1);
      if (before instanceof HTMLElement) before.focus();
    };
  }, []);

  return ref;
}
