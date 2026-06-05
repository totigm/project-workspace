"use client";

import { AnimatePresence, motion, type Variants } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type UpgradeModalProps = {
  open: boolean;
  used: number;
  limit: number;
  onClose: () => void;
  onUpgrade?: () => void;
};

const PERKS = ["Unlimited active projects", "No archiving to make room", "Priority support"];

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.08 } }
};

const item: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] } }
};

export function UpgradeModal({ open, used, limit, onClose, onUpgrade }: UpgradeModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Scroll lock + focus management while open.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => {
      cardRef.current?.querySelector<HTMLButtonElement>("[data-autofocus]")?.focus();
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
        onClose();
        return;
      }
      if (event.key !== "Tab" || !cardRef.current) return;
      const focusable = cardRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
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
  }, [open, onClose]);

  if (!mounted) return null;
  const fillPct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100;

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
            aria-labelledby="upgrade-title"
            aria-describedby="upgrade-desc"
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
              className="absolute right-4 top-4 grid size-9 place-items-center rounded-full text-subtle transition-colors hover:bg-surface-2 hover:text-text"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>

            <motion.div variants={container} initial="hidden" animate="show">
              <motion.span
                variants={item}
                className="grid size-14 place-items-center rounded-2xl text-[var(--accent-contrast)]"
                style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))", boxShadow: "var(--shadow-glow)" }}
                aria-hidden="true"
              >
                <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M13 2 4.5 13.2c-.4.5 0 1.3.6 1.3H11l-1 8 8.5-11.2c.4-.5 0-1.3-.6-1.3H12l1-8Z" fill="currentColor" />
                </svg>
              </motion.span>

              <motion.p variants={item} className="mt-5 text-[0.72rem] font-bold uppercase tracking-[0.12em] text-accent-ink">
                Free plan
              </motion.p>
              <motion.h2 variants={item} id="upgrade-title" className="mt-1.5 text-2xl font-extrabold tracking-tight text-text">
                You&rsquo;ve hit your project limit
              </motion.h2>
              <motion.p variants={item} id="upgrade-desc" className="mt-2.5 text-[0.95rem] leading-relaxed text-muted">
                Free workspaces hold up to {limit} active projects. Upgrade to Pro for unlimited
                projects — never archive good work to make room again.
              </motion.p>

              <motion.div variants={item} className="mt-5">
                <div
                  className="h-2.5 overflow-hidden rounded-full bg-surface-3"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={limit}
                  aria-valuenow={used}
                  aria-label={`${used} of ${limit} projects used`}
                >
                  <motion.span
                    className="block h-full rounded-full"
                    style={{ background: "linear-gradient(90deg, var(--accent), var(--accent-2))" }}
                    initial={{ width: 0 }}
                    animate={{ width: `${fillPct}%` }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
                  />
                </div>
                <p className="mt-2 text-[0.8rem] font-semibold text-muted">
                  <span className="tabular text-text">{used}</span> of {limit} projects used
                </p>
              </motion.div>

              <motion.ul variants={item} className="mt-5 space-y-2">
                {PERKS.map((perk) => (
                  <li key={perk} className="flex items-center gap-2.5 text-sm text-text">
                    <span
                      className="grid size-5 place-items-center rounded-full"
                      style={{ background: "var(--active-soft)", color: "var(--active)" }}
                      aria-hidden="true"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24">
                        <path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    {perk}
                  </li>
                ))}
              </motion.ul>

              <motion.div variants={item} className="mt-6 flex flex-col gap-2.5">
                <motion.button
                  type="button"
                  data-autofocus
                  whileTap={{ scale: 0.98 }}
                  onClick={onUpgrade ?? onClose}
                  className="h-12 rounded-[var(--radius-md)] font-bold text-[var(--accent-contrast)] transition-[filter] hover:brightness-110"
                  style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))", boxShadow: "var(--shadow-glow)" }}
                >
                  Upgrade to Pro
                </motion.button>
                <button
                  type="button"
                  onClick={onClose}
                  className="h-11 rounded-[var(--radius-md)] font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-text"
                >
                  Maybe later
                </button>
              </motion.div>
            </motion.div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
