"use client";

import { useEffect, useRef, useState } from "react";

type UpgradeModalProps = {
  open: boolean;
  used: number;
  limit: number;
  onClose: () => void;
  onUpgrade?: () => void;
};

const EXIT_MS = 260;

export function UpgradeModal({ open, used, limit, onClose, onUpgrade }: UpgradeModalProps) {
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
    cardRef.current?.querySelector<HTMLButtonElement>("[data-autofocus]")?.focus();

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

  const fillPct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100;

  return (
    <div
      className="upgrade-overlay"
      data-visible={visible}
      role="presentation"
      onClick={onClose}
    >
      <div
        className="upgrade-card"
        data-visible={visible}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-title"
        aria-describedby="upgrade-desc"
        ref={cardRef}
        onClick={(event) => event.stopPropagation()}
      >
        <span className="upgrade-grip" aria-hidden="true" />

        <button className="upgrade-close" type="button" aria-label="Dismiss" onClick={onClose}>
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

        <span className="upgrade-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="26" height="26">
            <path
              d="M12 3l2.4 5 5.6.6-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.6-.6L12 3z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
        </span>

        <p className="upgrade-eyebrow">Free plan</p>
        <h2 id="upgrade-title">You&rsquo;ve reached your project limit</h2>
        <p id="upgrade-desc" className="upgrade-desc">
          Free workspaces can hold up to {limit} projects. Upgrade to Pro for unlimited
          projects, so your team never has to archive good work to make room.
        </p>

        <div className="upgrade-meter">
          <div
            className="upgrade-meter-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={limit}
            aria-valuenow={used}
            aria-label={`${used} of ${limit} projects used`}
          >
            <span
              className="upgrade-meter-fill"
              style={{ width: visible ? `${fillPct}%` : "0%" }}
            />
          </div>
          <span className="upgrade-meter-label">
            <strong>{used}</strong> of {limit} projects used
          </span>
        </div>

        <div className="upgrade-actions">
          <button
            className="upgrade-primary"
            type="button"
            data-autofocus
            onClick={onUpgrade ?? onClose}
          >
            Upgrade to Pro
          </button>
          <button className="upgrade-secondary" type="button" onClick={onClose}>
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
