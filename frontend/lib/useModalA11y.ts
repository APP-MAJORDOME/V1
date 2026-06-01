'use client';

import { useEffect, type RefObject } from 'react';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Échap, piège de focus et restauration du focus à la fermeture. */
export function useModalA11y(
  open: boolean,
  onClose: () => void,
  panelRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;

    const previous = document.activeElement as HTMLElement | null;

    const focusFirst = () => {
      const root = panelRef.current;
      if (!root) return;
      const nodes = root.querySelectorAll<HTMLElement>(FOCUSABLE);
      const first = nodes[0];
      if (first) first.focus();
      else root.focus();
    };

    const t = window.setTimeout(focusFirst, 0);

    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        onClose();
        return;
      }
      if (ev.key !== 'Tab') return;
      const root = panelRef.current;
      if (!root) return;
      const nodes = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (nodes.length === 0) return;
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      if (ev.shiftKey) {
        if (document.activeElement === first) {
          ev.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        ev.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKeyDown);
      previous?.focus?.();
    };
  }, [open, onClose, panelRef]);
}
