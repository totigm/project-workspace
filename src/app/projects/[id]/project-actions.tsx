"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { Modal } from "@/app/modal";
import { EditProjectModal, type SaveResult } from "@/app/edit-project-modal";
import { useToast } from "@/app/toast";
import type { ClientProject } from "@/app/workspace";

type ProjectActionsProps = {
  userId: string;
  projectId: string;
  name: string;
  status: string;
  createdAt: string;
};

export function ProjectActions({ userId, projectId, name, status, createdAt }: ProjectActionsProps) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isArchived = status.toUpperCase() === "ARCHIVED";

  const project: ClientProject = { id: projectId, name, status, createdAt };

  async function handleSave(id: string, nextName: string, nextStatus: string): Promise<SaveResult> {
    const res = await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
      body: JSON.stringify({ name: nextName, status: nextStatus })
    });
    if (!res.ok) {
      return "error";
    }
    toast({ title: "Project updated", variant: "success" });
    router.refresh();
    return "ok";
  }

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "DELETE",
      headers: { "x-user-id": userId }
    });
    setDeleting(false);
    if (res.ok) {
      toast({ title: "Project deleted", variant: "success" });
      router.push(`/?userId=${userId}`);
    } else {
      toast({ title: "Unable to delete project", variant: "error" });
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-2.5">
      {!isArchived ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="h-10 rounded-[var(--radius-md)] border border-border bg-surface-2 px-4 font-semibold text-text transition-colors hover:bg-surface-3"
        >
          Edit
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="h-10 rounded-[var(--radius-md)] px-4 font-semibold transition-[filter] hover:brightness-110"
        style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
      >
        Delete
      </button>

      <EditProjectModal
        open={editing}
        project={editing ? project : null}
        onClose={() => setEditing(false)}
        onSave={handleSave}
      />

      <Modal open={confirming} onClose={() => setConfirming(false)} labelledBy="confirm-delete-title">
        <p
          className="text-[0.72rem] font-bold uppercase tracking-[0.12em]"
          style={{ color: "var(--danger)" }}
        >
          Delete project
        </p>
        <h2
          id="confirm-delete-title"
          className="mt-1.5 truncate text-2xl font-extrabold tracking-tight text-text"
        >
          Delete &ldquo;{name}&rdquo;?
        </h2>
        <p className="mt-2 text-[0.9rem] leading-snug text-muted">
          This permanently removes the project and all of its tasks. This can&rsquo;t be undone.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="h-11 rounded-[var(--radius-md)] px-4 font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-text"
          >
            Cancel
          </button>
          <motion.button
            type="button"
            data-autofocus
            disabled={deleting}
            whileTap={{ scale: 0.98 }}
            onClick={handleDelete}
            className="inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] px-5 font-semibold transition-[filter,opacity] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: "var(--danger)", color: "#fff" }}
          >
            {deleting ? "Deleting…" : "Delete project"}
          </motion.button>
        </div>
      </Modal>
    </div>
  );
}
