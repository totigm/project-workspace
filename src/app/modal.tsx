"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  describedBy?: string;
  children: ReactNode;
};

/**
 * Accessible dialog shell shared by every modal in the app. Centered card on
 * desktop, slide-up sheet on phones. Handles enter/exit animation (Framer),
 * focus trapping, Escape-to-close, and background scroll lock so callers only
 * provide content. Put `data-autofocus` on the element to focus on open.
 */
export function Modal({ open, onClose, labelledBy, describedBy, children }: ModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Hold the latest onClose in a ref so the key handler can stay bound while the
  // modal is open instead of re-subscribing every time the parent passes a new
  // onClose identity (e.g. a fresh closure each render).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Scroll lock + focus management while open.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => {
      cardRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }, 80);

    return () => {
      document.body.style.overflow = overflow;
      window.clearTimeout(focusTimer);
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  // ESC to close + focus trap.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !cardRef.current) return;
      // Only currently-focusable controls — skip disabled ones so Tab never
      // lands on, say, a disabled "Save" button mid-submit.
      const focusable = cardRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[1000] flex items-end justify-center sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          role="presentation"
          style={{ background: "rgba(6, 8, 12, 0.62)", backdropFilter: "blur(6px)" }}
        >
          <motion.div
            ref={cardRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            aria-describedby={describedBy}
            onClick={(event) => event.stopPropagation()}
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.97, transition: { duration: 0.18 } }}
            transition={{ type: "spring", stiffness: 360, damping: 30 }}
            className="panel relative w-full overflow-hidden rounded-b-none rounded-t-3xl px-7 pb-[calc(1.6rem+env(safe-area-inset-bottom))] pt-6 sm:w-[min(100%,448px)] sm:rounded-2xl sm:pb-7"
            style={{ boxShadow: "var(--shadow-lg)" }}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-10 -top-20 h-40"
              style={{ background: "radial-gradient(60% 100% at 50% 0%, var(--accent-soft), transparent 70%)" }}
            />
            <span
              aria-hidden="true"
              className="mx-auto mb-5 block h-1 w-10 rounded-full bg-border-strong sm:hidden"
            />
            <button
              type="button"
              onClick={onClose}
              aria-label="Dismiss"
              className="absolute right-4 top-4 z-10 grid size-9 place-items-center rounded-full text-subtle transition-colors hover:bg-surface-2 hover:text-text"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
