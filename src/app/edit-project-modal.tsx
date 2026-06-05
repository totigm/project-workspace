"use client";

import { CSSProperties, FormEvent, useEffect, useState } from "react";
import { Modal } from "@/app/modal";

export type EditableProject = {
  id: string;
  name: string;
  status: string;
};

type EditProjectModalProps = {
  open: boolean;
  project: EditableProject | null;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
};

export function EditProjectModal({
  open,
  project,
  userId,
  onClose,
  onSaved
}: EditProjectModalProps) {
  // Retain the last project so the content stays rendered during the exit
  // animation, after `project` has been cleared by the parent.
  const [snapshot, setSnapshot] = useState<EditableProject | null>(project);
  const [name, setName] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (project) {
      setSnapshot(project);
      setName(project.name);
      setStatus(project.status);
      setError(null);
    }
  }, [project]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!snapshot) {
      return;
    }

    setIsSaving(true);
    setError(null);

    const response = await fetch(`/api/projects/${snapshot.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId
      },
      body: JSON.stringify({ name, status })
    });
    const payload = (await response.json()) as { error?: string };

    setIsSaving(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to save changes.");
      return;
    }

    onSaved();
  }

  const willArchive = status === "ARCHIVED" && snapshot?.status !== "ARCHIVED";

  return (
    <Modal open={open} onClose={onClose} labelledBy="edit-title">
      <p className="upgrade-eyebrow stagger" style={stagger(0)}>
        Edit project
      </p>
      <h2 id="edit-title" className="edit-heading stagger" style={stagger(1)}>
        {snapshot?.name}
      </h2>

      <form className="edit-form" onSubmit={onSubmit}>
        <div className="stagger" style={stagger(2)}>
          <label htmlFor="edit-name">Name</label>
          <input
            id="edit-name"
            name="name"
            data-autofocus
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Project name"
          />
        </div>

        <div className="stagger" style={stagger(3)}>
          <label htmlFor="edit-status">Status</label>
          <select
            id="edit-status"
            name="status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
            <option value="ARCHIVED">Archive (permanent)</option>
          </select>
        </div>

        {willArchive ? (
          <p className="edit-warning stagger" style={stagger(4)} role="status">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path
                d="M12 3l9 16H3l9-16zM12 10v4M12 17.5v.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Archiving is permanent &mdash; this project can&rsquo;t be reactivated, but it
            frees a slot on your plan.
          </p>
        ) : null}

        {error ? (
          <p className="edit-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="modal-actions-row stagger" style={stagger(5)}>
          <button className="btn-ghost" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" type="submit" disabled={isSaving}>
            {isSaving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function stagger(index: number): CSSProperties {
  return { ["--i" as string]: index };
}
