"use client";

import { ReactNode, useEffect, useRef, useState } from "react";

const EXIT_MS = 260;

type ModalProps = {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  describedBy?: string;
  children: ReactNode;
};

/**
 * Accessible dialog shell shared by every modal in the app. Renders a centered
 * card on desktop and a slide-up sheet on phones (see globals.css). Handles the
 * enter/exit animation, focus trapping, Escape-to-close, and background scroll
 * lock so callers only provide content.
 */
export function Modal({ open, onClose, labelledBy, describedBy, children }: ModalProps) {
  // `mounted` keeps the node in the tree long enough to play the exit animation;
  // `visible` is the flag the CSS transitions actually key off of.
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      previouslyFocused.current = document.activeElement as HTMLElement | null;
      setMounted(true);
      // Two frames so the browser paints the initial (hidden) state before we
      // flip to visible — otherwise the enter transition is skipped.
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      return () => cancelAnimationFrame(raf);
    }

    if (mounted) {
      setVisible(false);
      const timer = setTimeout(() => setMounted(false), EXIT_MS);
      return () => clearTimeout(timer);
    }
  }, [open, mounted]);

  // Lock background scroll, move focus in, and restore it on close.
  useEffect(() => {
    if (!visible) {
      return;
    }

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    cardRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();

    return () => {
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus?.();
    };
  }, [visible]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !cardRef.current) {
        return;
      }

      const focusable = cardRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) {
        return;
      }

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
  }, [mounted, onClose]);

  if (!mounted) {
    return null;
  }

  return (
    <div className="modal-overlay" data-visible={visible} role="presentation" onClick={onClose}>
      <div
        className="modal-card"
        data-visible={visible}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        ref={cardRef}
        onClick={(event) => event.stopPropagation()}
      >
        <span className="modal-grip" aria-hidden="true" />

        <button className="modal-close" type="button" aria-label="Dismiss" onClick={onClose}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>

        {children}
      </div>
    </div>
  );
}
