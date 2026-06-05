"use client";

import { CSSProperties, useEffect, useState } from "react";
import { Modal } from "@/app/modal";

type UpgradeModalProps = {
  open: boolean;
  used: number;
  limit: number;
  onClose: () => void;
  onUpgrade?: () => void;
};

export function UpgradeModal({ open, used, limit, onClose, onUpgrade }: UpgradeModalProps) {
  const fillPct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100;

  // Arm the meter one frame after opening so its width animates from 0 → full
  // instead of rendering pre-filled.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!open) {
      setArmed(false);
      return;
    }
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setArmed(true)));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} labelledBy="upgrade-title" describedBy="upgrade-desc">
      <span className="upgrade-icon stagger" style={stagger(0)} aria-hidden="true">
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

      <p className="upgrade-eyebrow stagger" style={stagger(1)}>
        Free plan
      </p>
      <h2 id="upgrade-title" className="stagger" style={stagger(2)}>
        You&rsquo;ve reached your active project limit
      </h2>
      <p id="upgrade-desc" className="upgrade-desc stagger" style={stagger(3)}>
        Free workspaces can keep up to {limit} active projects at once. Archive a project
        to free a slot, or upgrade to Pro for unlimited projects.
      </p>

      <div className="upgrade-meter stagger" style={stagger(4)}>
        <div
          className="upgrade-meter-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuenow={used}
          aria-label={`${used} of ${limit} active projects used`}
        >
          <span
            className="upgrade-meter-fill"
            style={{ width: armed ? `${fillPct}%` : "0%" }}
          />
        </div>
        <span className="upgrade-meter-label">
          <strong>{used}</strong> of {limit} active projects used
        </span>
      </div>

      <div className="modal-actions stagger" style={stagger(5)}>
        <button
          className="btn-primary"
          type="button"
          data-autofocus
          onClick={onUpgrade ?? onClose}
        >
          Upgrade to Pro
        </button>
        <button className="btn-ghost" type="button" onClick={onClose}>
          Maybe later
        </button>
      </div>
    </Modal>
  );
}

function stagger(index: number): CSSProperties {
  return { ["--i" as string]: index };
}
