"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/app/modal";
import { EditProjectModal, EditableProject } from "@/app/edit-project-modal";

type ProjectActionsProps = {
  userId: string;
  projectId: string;
  name: string;
  status: string;
};

export function ProjectActions({ userId, projectId, name, status }: ProjectActionsProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isArchived = status === "ARCHIVED";

  // EditableProject is { id, name, status } with a string status — no cast needed.
  const editableProject: EditableProject | null = isArchived
    ? null
    : { id: projectId, name, status };

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "DELETE",
      headers: { "x-user-id": userId }
    });
    setDeleting(false);
    if (res.ok) {
      router.push(`/?userId=${userId}`);
    }
  }

  return (
    <div className="detail-actions">
      {!isArchived ? (
        <button type="button" className="secondary" onClick={() => setEditing(true)}>
          Edit
        </button>
      ) : null}
      <button type="button" className="danger" onClick={() => setConfirming(true)}>
        Delete
      </button>

      <EditProjectModal
        open={editing}
        project={editableProject}
        userId={userId}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          router.refresh();
        }}
      />

      <Modal open={confirming} onClose={() => setConfirming(false)} labelledBy="confirm-delete-title">
        <div className="confirm">
          <h2 id="confirm-delete-title">Delete this project?</h2>
          <p className="subtle">This permanently removes the project and all its tasks.</p>
          <div className="task-form-actions">
            <button type="button" className="danger" data-autofocus disabled={deleting} onClick={handleDelete}>
              {deleting ? "Deleting…" : "Delete project"}
            </button>
            <button type="button" className="secondary" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
