"use client";

import { useMemo, useRef, useState } from "react";
import { Reorder, useReducedMotion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SerializedTask } from "@/lib/serialize";
import { TaskDraft, TaskModal } from "@/app/projects/[id]/task-modal";

const COLUMNS = [
  { status: "TODO", label: "Todo" },
  { status: "DOING", label: "Doing" },
  { status: "DONE", label: "Done" }
] as const;

type ColumnStatus = (typeof COLUMNS)[number]["status"];

type TaskBoardProps = {
  userId: string;
  projectId: string;
  initialTasks: SerializedTask[];
  readOnly: boolean;
};

const headers = (userId: string) => ({ "Content-Type": "application/json", "x-user-id": userId });

// Order columns left-to-right so the move arrows can compute the neighbour.
const STATUS_ORDER: ColumnStatus[] = COLUMNS.map((c) => c.status);

export function TaskBoard({ userId, projectId, initialTasks, readOnly }: TaskBoardProps) {
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const queryKey = ["project-tasks", projectId];

  // True while a within-column drag is in flight, so the cache echo from our own
  // optimistic move/refetch doesn't yank the list mid-drag (the sync trap).
  const dragging = useRef(false);

  const { data: tasks = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`, { headers: headers(userId) });
      if (!res.ok) throw new Error("Failed to load tasks");
      const body = (await res.json()) as { project: { tasks: SerializedTask[] } };
      return body.project.tasks;
    },
    initialData: initialTasks
  });

  const [editing, setEditing] = useState<SerializedTask | null>(null);
  const [creating, setCreating] = useState(false);

  const byColumn = useMemo(() => {
    const map: Record<string, SerializedTask[]> = { TODO: [], DOING: [], DONE: [] };
    for (const t of tasks) map[t.status]?.push(t);
    for (const key of Object.keys(map)) map[key].sort((a, b) => a.position - b.position);
    return map;
  }, [tasks]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const createMutation = useMutation({
    mutationFn: async (draft: TaskDraft) => {
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: headers(userId),
        body: JSON.stringify(draft)
      });
      if (!res.ok) throw new Error("create failed");
    },
    onSuccess: invalidate
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, draft }: { id: string; draft: TaskDraft }) => {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: headers(userId),
        body: JSON.stringify(draft)
      });
      if (!res.ok) throw new Error("edit failed");
    },
    onSuccess: invalidate
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE", headers: headers(userId) });
      if (!res.ok) throw new Error("delete failed");
    },
    onSuccess: invalidate
  });

  // Move: optimistic update of the cache, then PATCH; invalidate to reconcile.
  const moveMutation = useMutation({
    mutationFn: async ({ id, status, position }: { id: string; status: string; position: number }) => {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: headers(userId),
        body: JSON.stringify({ status, position })
      });
      if (!res.ok) throw new Error("move failed");
    },
    onMutate: async ({ id, status, position }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<SerializedTask[]>(queryKey);
      queryClient.setQueryData<SerializedTask[]>(queryKey, (old = []) =>
        old.map((t) => (t.id === id ? { ...t, status: status as SerializedTask["status"], position } : t))
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
    },
    onSettled: invalidate
  });

  // Within-column reorder from framer-motion. Persist only the cards whose
  // status or index actually changed.
  function handleReorder(status: ColumnStatus, reordered: SerializedTask[]) {
    reordered.forEach((task, index) => {
      if (task.status !== status || task.position !== index) {
        moveMutation.mutate({ id: task.id, status, position: index });
      }
    });
  }

  // Cross-column move via the per-card arrows. Drop the card at the end of the
  // target column (its current length = next free position).
  function moveToColumn(task: SerializedTask, direction: -1 | 1) {
    const fromIndex = STATUS_ORDER.indexOf(task.status as ColumnStatus);
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= STATUS_ORDER.length) return;
    const targetStatus = STATUS_ORDER[toIndex];
    const position = byColumn[targetStatus].length;
    moveMutation.mutate({ id: task.id, status: targetStatus, position });
  }

  return (
    <section className="board" aria-label="Task board">
      {COLUMNS.map((col) => {
        const colIndex = STATUS_ORDER.indexOf(col.status);
        return (
          <div className="board-col" key={col.status}>
            <header className="board-col-head">
              <h2>{col.label}</h2>
              <span className="board-col-count">{byColumn[col.status].length}</span>
            </header>

            <Reorder.Group
              axis="y"
              values={byColumn[col.status]}
              onReorder={(items) => {
                if (readOnly) return;
                handleReorder(col.status, items as SerializedTask[]);
              }}
              className="board-col-list"
            >
              {byColumn[col.status].map((task) => (
                <Reorder.Item
                  key={task.id}
                  value={task}
                  className="task-card"
                  drag={!readOnly ? "y" : false}
                  onDragStart={() => {
                    dragging.current = true;
                  }}
                  onDragEnd={() => {
                    dragging.current = false;
                  }}
                  whileDrag={
                    reduceMotion
                      ? undefined
                      : { scale: 1.02, boxShadow: "0 12px 30px rgba(0,0,0,.45)", zIndex: 1 }
                  }
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 600, damping: 40 }
                  }
                >
                  <button className="task-card-main" type="button" onClick={() => setEditing(task)}>
                    <span className="task-card-title">{task.title}</span>
                    {task.dueDate ? (
                      <span className="task-card-due">{task.dueDate.slice(0, 10)}</span>
                    ) : null}
                    {task.description ? <span className="task-card-note" aria-hidden="true" /> : null}
                  </button>
                  {!readOnly ? (
                    <div className="task-card-move" role="group" aria-label="Move task">
                      <button
                        type="button"
                        className="task-card-move-btn"
                        aria-label={`Move ${task.title} to ${COLUMNS[colIndex - 1]?.label ?? ""}`}
                        disabled={colIndex === 0}
                        onClick={() => moveToColumn(task, -1)}
                      >
                        ◀
                      </button>
                      <button
                        type="button"
                        className="task-card-move-btn"
                        aria-label={`Move ${task.title} to ${COLUMNS[colIndex + 1]?.label ?? ""}`}
                        disabled={colIndex === STATUS_ORDER.length - 1}
                        onClick={() => moveToColumn(task, 1)}
                      >
                        ▶
                      </button>
                    </div>
                  ) : null}
                  {!readOnly ? (
                    <button
                      className="task-card-delete"
                      type="button"
                      aria-label={`Delete ${task.title}`}
                      onClick={() => deleteMutation.mutate(task.id)}
                    >
                      ×
                    </button>
                  ) : null}
                </Reorder.Item>
              ))}
            </Reorder.Group>

            {col.status === "TODO" && !readOnly ? (
              <button className="board-add" type="button" onClick={() => setCreating(true)}>
                + Add task
              </button>
            ) : null}
            {byColumn[col.status].length === 0 ? (
              <p className="board-empty">Nothing here yet.</p>
            ) : null}
          </div>
        );
      })}

      <TaskModal
        open={creating || editing !== null}
        task={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSubmit={(draft) => {
          if (editing) {
            editMutation.mutate({ id: editing.id, draft });
          } else {
            createMutation.mutate(draft);
          }
          setCreating(false);
          setEditing(null);
        }}
      />
    </section>
  );
}
