"use client";

import { FormEvent, useEffect, useState } from "react";
import { Modal } from "@/app/modal";
import { SerializedTask } from "@/lib/serialize";

export type TaskDraft = { title: string; description: string; dueDate: string };

type TaskModalProps = {
  open: boolean;
  task: SerializedTask | null; // null = create mode
  onClose: () => void;
  onSubmit: (draft: TaskDraft) => void;
};

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
      <form className="task-form" onSubmit={handleSubmit}>
        <h2 id="task-modal-title">{task ? "Edit task" : "New task"}</h2>

        <label htmlFor="task-title">Title</label>
        <input
          id="task-title"
          data-autofocus
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          placeholder="Write the spec"
        />

        <label htmlFor="task-desc">Description</label>
        <textarea
          id="task-desc"
          rows={4}
          value={draft.description}
          onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
        />

        <label htmlFor="task-due">Due date</label>
        <input
          id="task-due"
          type="date"
          value={draft.dueDate}
          onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))}
        />

        <div className="task-form-actions">
          <button type="submit" className="primary">
            {task ? "Save" : "Add task"}
          </button>
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
