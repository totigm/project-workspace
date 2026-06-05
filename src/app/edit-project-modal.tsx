"use client";

import { motion } from "framer-motion";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Modal } from "@/app/modal";
import { Select, type SelectOption } from "@/app/select";
import type { ClientProject } from "@/app/workspace";

export type SaveResult = "ok" | "error";

type EditProjectModalProps = {
  open: boolean;
  project: ClientProject | null;
  onClose: () => void;
  onSave: (id: string, name: string, status: string) => Promise<SaveResult>;
};

const STATUS_OPTIONS: SelectOption[] = [
  { value: "ACTIVE", label: "Active", dot: "var(--active)" },
  { value: "PAUSED", label: "Paused", dot: "var(--paused)" },
  { value: "ARCHIVED", label: "Archive (permanent)", dot: "var(--archived)" }
];

export function EditProjectModal({ open, project, onClose, onSave }: EditProjectModalProps) {
  // Retain the last project so content stays rendered during the exit animation,
  // after the parent clears `project`.
  const [snapshot, setSnapshot] = useState<ClientProject | null>(project);
  const [name, setName] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const keepEditingRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (project) {
      setSnapshot(project);
      setName(project.name);
      setStatus(project.status);
      setError(null);
      setConfirmDiscard(false);
    }
  }, [project]);

  // Move focus to the safe default ("Keep editing") when the discard prompt appears.
  useEffect(() => {
    if (confirmDiscard) {
      keepEditingRef.current?.focus();
    }
  }, [confirmDiscard]);

  const isDirty =
    snapshot !== null && (name !== snapshot.name || status !== snapshot.status);
  const willArchive = status === "ARCHIVED" && snapshot?.status !== "ARCHIVED";

  // Intercept every dismissal path (backdrop, Escape, ✕, Cancel): if there are
  // unsaved edits, ask before throwing them away.
  function requestClose() {
    if (isDirty) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  }

  function discard() {
    setConfirmDiscard(false);
    onClose();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!snapshot) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Project name is required.");
      return;
    }

    setIsSaving(true);
    setError(null);
    const result = await onSave(snapshot.id, trimmed, status);
    setIsSaving(false);

    if (result === "ok") {
      onClose();
    } else {
      setError("Unable to save changes. Please try again.");
    }
  }

  return (
    <Modal open={open} onClose={requestClose} labelledBy="edit-title">
      <p className="text-[0.72rem] font-bold uppercase tracking-[0.12em] text-accent-ink">
        Edit project
      </p>
      <h2 id="edit-title" className="mt-1.5 truncate text-2xl font-extrabold tracking-tight text-text">
        {snapshot?.name}
      </h2>

      <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-4">
        <div>
          <label htmlFor="edit-name" className="mb-1.5 block text-[0.72rem] font-bold uppercase tracking-wide text-subtle">
            Name
          </label>
          <input
            id="edit-name"
            name="name"
            data-autofocus
            type="text"
            value={name}
            maxLength={80}
            placeholder="Project name"
            aria-invalid={Boolean(error)}
            onChange={(event) => {
              setName(event.target.value);
              if (error) setError(null);
            }}
            className="h-11 w-full rounded-[var(--radius-md)] border border-border bg-surface-2 px-3.5 text-text placeholder:text-subtle transition-[border-color,box-shadow] focus:border-accent-border focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>

        <div>
          <label id="edit-status-label" className="mb-1.5 block text-[0.72rem] font-bold uppercase tracking-wide text-subtle">
            Status
          </label>
          <Select
            id="edit-status"
            ariaLabel="Project status"
            value={status}
            options={STATUS_OPTIONS}
            onChange={setStatus}
          />
        </div>

        {willArchive ? (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            role="status"
            className="flex items-start gap-2.5 rounded-[var(--radius-md)] px-3.5 py-3 text-[0.84rem] leading-snug"
            style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
          >
            <svg className="mt-0.5 shrink-0" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path d="M12 3l9 16H3l9-16zM12 10v4M12 17.5v.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>
              Archiving is permanent — this project can&rsquo;t be reactivated, but it frees a
              slot on your plan.
            </span>
          </motion.p>
        ) : null}

        {error ? (
          <p role="alert" className="text-[0.84rem] font-medium" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        ) : null}

        {confirmDiscard ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            role="group"
            aria-label="Discard unsaved changes"
            className="mt-1 rounded-[var(--radius-md)] border border-border bg-surface-2 p-3.5"
          >
            <p className="text-[0.88rem] font-semibold text-text">Discard your unsaved changes?</p>
            <div className="mt-3 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
              <button
                ref={keepEditingRef}
                type="button"
                onClick={() => setConfirmDiscard(false)}
                className="h-10 rounded-[var(--radius-md)] px-4 text-sm font-semibold text-muted transition-colors hover:bg-surface-3 hover:text-text"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={discard}
                className="h-10 rounded-[var(--radius-md)] px-4 text-sm font-semibold transition-[filter] hover:brightness-110"
                style={{ background: "var(--danger)", color: "#fff" }}
              >
                Discard
              </button>
            </div>
          </motion.div>
        ) : (
          <div className="mt-1 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={requestClose}
              className="h-11 rounded-[var(--radius-md)] px-4 font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-text"
            >
              Cancel
            </button>
            <motion.button
              type="submit"
              disabled={isSaving}
              whileTap={{ scale: 0.98 }}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] px-5 font-semibold text-[var(--accent-contrast)] shadow-[var(--shadow-glow)] transition-[filter,opacity] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))" }}
            >
              {isSaving ? (
                <>
                  <svg className="motion-safe:animate-spin" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
                    <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </motion.button>
          </div>
        )}
      </form>
    </Modal>
  );
}
