"use client";

import { FormEvent, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Modal } from "@/app/modal";
import { SerializedTask } from "@/lib/serialize";

export type TaskDraft = { title: string; description: string; dueDate: string };

type TaskModalProps = {
  open: boolean;
  task: SerializedTask | null; // null = create mode
  onClose: () => void;
  onSubmit: (draft: TaskDraft) => void;
};

const FIELD =
  "w-full rounded-[var(--radius-md)] border border-border bg-surface-2 px-3.5 text-text placeholder:text-subtle transition-[border-color,box-shadow] focus:border-accent-border focus:outline-none focus:ring-2 focus:ring-[var(--ring)]";
const LABEL = "mb-1.5 block text-[0.72rem] font-bold uppercase tracking-wide text-subtle";

export function TaskModal({ open, task, onClose, onSubmit }: TaskModalProps) {
  const [draft, setDraft] = useState<TaskDraft>({ title: "", description: "", dueDate: "" });

  // Reset the form whenever the modal opens for a different task.
  useEffect(() => {
    if (open) {
      setDraft({
        title: task?.title ?? "",
        description: task?.description ?? "",
        dueDate: task?.dueDate ? task.dueDate.slice(0, 10) : ""
      });
    }
  }, [open, task]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.title.trim().length === 0) {
      return;
    }
    onSubmit(draft);
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="task-modal-title">
      <p className="text-[0.72rem] font-bold uppercase tracking-[0.12em] text-accent-ink">
        {task ? "Edit task" : "New task"}
      </p>
      <h2
        id="task-modal-title"
        className="mt-1.5 text-2xl font-extrabold tracking-tight text-text"
      >
        {task ? "Update task" : "Add a task"}
      </h2>

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
        <div>
          <label htmlFor="task-title" className={LABEL}>
            Title
          </label>
          <input
            id="task-title"
            data-autofocus
            type="text"
            value={draft.title}
            maxLength={120}
            placeholder="Write the spec"
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            className={`h-11 ${FIELD}`}
          />
        </div>

        <div>
          <label htmlFor="task-desc" className={LABEL}>
            Description
          </label>
          <textarea
            id="task-desc"
            rows={4}
            value={draft.description}
            placeholder="Add details (optional)"
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            className={`py-2.5 ${FIELD}`}
          />
        </div>

        <div>
          <label htmlFor="task-due" className={LABEL}>
            Due date
          </label>
          <input
            id="task-due"
            type="date"
            value={draft.dueDate}
            onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))}
            className={`h-11 ${FIELD}`}
          />
        </div>

        <div className="mt-1 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-[var(--radius-md)] px-4 font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-text"
          >
            Cancel
          </button>
          <motion.button
            type="submit"
            whileTap={{ scale: 0.98 }}
            className="inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] px-5 font-semibold text-[var(--accent-contrast)] shadow-[var(--shadow-glow)] transition-[filter] hover:brightness-110"
            style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))" }}
          >
            {task ? "Save" : "Add task"}
          </motion.button>
        </div>
      </form>
    </Modal>
  );
}
