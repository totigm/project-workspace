"use client";

import { motion, type Variants } from "framer-motion";
import { Modal } from "@/app/modal";

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
  const fillPct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100;

  return (
    <Modal open={open} onClose={onClose} labelledBy="upgrade-title" describedBy="upgrade-desc">
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
    </Modal>
  );
}
