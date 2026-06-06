"use client";

import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/app/toast";
import { SerializedTask } from "@/lib/serialize";
import { TaskDraft, TaskModal } from "@/app/projects/[id]/task-modal";

const COLUMNS = [
  { status: "TODO", label: "Todo" },
  { status: "DOING", label: "In progress" },
  { status: "DONE", label: "Done" }
] as const;

type ColumnStatus = (typeof COLUMNS)[number]["status"];
type Board = Record<ColumnStatus, SerializedTask[]>;

type TaskBoardProps = {
  userId: string;
  projectId: string;
  initialTasks: SerializedTask[];
  readOnly: boolean;
};

const headers = (userId: string) => ({ "Content-Type": "application/json", "x-user-id": userId });

function groupByStatus(tasks: SerializedTask[]): Board {
  const board: Board = { TODO: [], DOING: [], DONE: [] };
  for (const task of tasks) {
    (board[task.status as ColumnStatus] ?? board.TODO).push(task);
  }
  for (const status of Object.keys(board) as ColumnStatus[]) {
    board[status].sort((a, b) => a.position - b.position);
  }
  return board;
}

// Which column an id belongs to. `id` is either a column status or a card id.
function findContainer(board: Board, id: string): ColumnStatus | null {
  if (id in board) {
    return id as ColumnStatus;
  }
  return (
    (Object.keys(board) as ColumnStatus[]).find((status) =>
      board[status].some((task) => task.id === id)
    ) ?? null
  );
}

export function TaskBoard({ userId, projectId, initialTasks, readOnly }: TaskBoardProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const queryKey = ["project-tasks", projectId];

  const { data: tasks = initialTasks } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`, { headers: headers(userId) });
      if (!res.ok) throw new Error("Failed to load tasks");
      const body = (await res.json()) as { project: { tasks: SerializedTask[] } };
      return body.project.tasks;
    },
    initialData: initialTasks
  });

  // Local board mirrors server data, but is the source of truth DURING a drag so
  // the server round-trip can't fight the animation (see smooth-drag-drop skill).
  const [board, setBoard] = useState<Board>(() => groupByStatus(initialTasks));
  const boardRef = useRef(board);
  boardRef.current = board;
  const draggingRef = useRef(false);
  const [activeTask, setActiveTask] = useState<SerializedTask | null>(null);

  useEffect(() => {
    if (!draggingRef.current) {
      setBoard(groupByStatus(tasks));
    }
  }, [tasks]);

  const [editing, setEditing] = useState<SerializedTask | null>(null);
  const [creatingStatus, setCreatingStatus] = useState<ColumnStatus | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const createMutation = useMutation({
    mutationFn: async ({ draft, status }: { draft: TaskDraft; status: ColumnStatus }) => {
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: headers(userId),
        body: JSON.stringify({ ...draft, status })
      });
      if (!res.ok) throw new Error("create failed");
    },
    onSuccess: () => {
      toast({ title: "Task added", variant: "success" });
      invalidate();
    },
    onError: () => toast({ title: "Couldn't add task", variant: "error" })
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
    onSuccess: invalidate,
    onError: () => toast({ title: "Couldn't save task", variant: "error" })
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE", headers: headers(userId) });
      if (!res.ok) throw new Error("delete failed");
    },
    onSuccess: invalidate,
    onError: () => toast({ title: "Couldn't delete task", variant: "error" })
  });

  // Persist a move. The local board already reflects it optimistically; on error
  // we refetch (onSettled) which re-syncs the board to server truth.
  const moveMutation = useMutation({
    mutationFn: async ({ id, status, position }: { id: string; status: string; position: number }) => {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: headers(userId),
        body: JSON.stringify({ status, position })
      });
      if (!res.ok) throw new Error("move failed");
    },
    onError: () => toast({ title: "Couldn't move task", variant: "error" }),
    onSettled: invalidate
  });

  const sensors = useSensors(
    // A small activation distance lets clicks (edit/delete) through without starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragStart(event: DragStartEvent) {
    draggingRef.current = true;
    const id = String(event.active.id);
    const container = findContainer(boardRef.current, id);
    setActiveTask(container ? boardRef.current[container].find((t) => t.id === id) ?? null : null);
  }

  // Live cross-column move: relocate the dragged card into the column it's over.
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    const current = boardRef.current;
    const from = findContainer(current, activeId);
    const to = findContainer(current, overId);
    if (!from || !to || from === to) return;

    setBoard((prev) => {
      const fromItems = prev[from];
      const toItems = prev[to];
      const moving = fromItems.find((t) => t.id === activeId);
      if (!moving) return prev;

      const overIsColumn = overId in prev;
      const overIndex = overIsColumn ? toItems.length : toItems.findIndex((t) => t.id === overId);
      const insertAt = overIndex < 0 ? toItems.length : overIndex;

      return {
        ...prev,
        [from]: fromItems.filter((t) => t.id !== activeId),
        [to]: [
          ...toItems.slice(0, insertAt),
          { ...moving, status: to },
          ...toItems.slice(insertAt)
        ]
      };
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    draggingRef.current = false;
    setActiveTask(null);
    const { active, over } = event;
    if (!over) {
      setBoard(groupByStatus(tasks));
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);
    const current = boardRef.current;
    const container = findContainer(current, overId);
    const from = findContainer(current, activeId);
    if (!container || !from) return;

    const items = current[container];
    const oldIndex = items.findIndex((t) => t.id === activeId);
    const overIndex = overId in current ? items.length - 1 : items.findIndex((t) => t.id === overId);
    const newItems =
      oldIndex >= 0 && overIndex >= 0 && oldIndex !== overIndex
        ? arrayMove(items, oldIndex, overIndex)
        : items;

    const next = { ...current, [container]: newItems };
    setBoard(next);

    const position = next[container].findIndex((t) => t.id === activeId);
    moveMutation.mutate({ id: activeId, status: container, position });
  }

  function handleDragCancel() {
    draggingRef.current = false;
    setActiveTask(null);
    setBoard(groupByStatus(tasks));
  }

  const columns = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {COLUMNS.map((col) => (
        <Column
          key={col.status}
          status={col.status}
          label={col.label}
          tasks={board[col.status]}
          readOnly={readOnly}
          onAdd={() => setCreatingStatus(col.status)}
          onEdit={setEditing}
          onDelete={(id) => deleteMutation.mutate(id)}
        />
      ))}
    </div>
  );

  return (
    <section aria-label="Task board">
      {readOnly ? (
        columns
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          {columns}
          <DragOverlay>
            {activeTask ? <TaskCardContent task={activeTask} dragging /> : null}
          </DragOverlay>
        </DndContext>
      )}

      <TaskModal
        open={creatingStatus !== null || editing !== null}
        task={editing}
        onClose={() => {
          setCreatingStatus(null);
          setEditing(null);
        }}
        onSubmit={(draft) => {
          if (editing) {
            editMutation.mutate({ id: editing.id, draft });
          } else {
            createMutation.mutate({ draft, status: creatingStatus ?? "TODO" });
          }
          setCreatingStatus(null);
          setEditing(null);
        }}
      />
    </section>
  );
}

type ColumnProps = {
  status: ColumnStatus;
  label: string;
  tasks: SerializedTask[];
  readOnly: boolean;
  onAdd?: () => void;
  onEdit: (task: SerializedTask) => void;
  onDelete: (id: string) => void;
};

function Column({ status, label, tasks, readOnly, onAdd, onEdit, onDelete }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="panel flex flex-col gap-3 p-4">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-subtle">{label}</h2>
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs tabular text-muted">
          {tasks.length}
        </span>
      </header>

      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
        disabled={readOnly}
      >
        <ul
          ref={setNodeRef}
          className={`flex min-h-[64px] flex-col gap-2 rounded-[var(--radius-md)] transition-colors ${
            isOver ? "bg-accent-soft" : ""
          }`}
        >
          {tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              readOnly={readOnly}
              onEdit={() => onEdit(task)}
              onDelete={() => onDelete(task.id)}
            />
          ))}
          {tasks.length === 0 ? (
            <li className="grid place-items-center px-2 py-6 text-sm text-muted">Nothing here yet.</li>
          ) : null}
        </ul>
      </SortableContext>

      {onAdd && !readOnly ? (
        <button
          type="button"
          onClick={onAdd}
          className="rounded-[var(--radius-md)] border border-dashed border-border px-3 py-2 text-sm font-semibold text-muted transition-colors hover:border-accent-border hover:text-text"
        >
          + Add task
        </button>
      ) : null}
    </div>
  );
}

type SortableTaskCardProps = {
  task: SerializedTask;
  readOnly: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

function SortableTaskCard({ task, readOnly, onEdit, onDelete }: SortableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: readOnly
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1
  };

  return (
    <li ref={setNodeRef} style={style}>
      <TaskCardContent
        task={task}
        readOnly={readOnly}
        onEdit={onEdit}
        onDelete={onDelete}
        dragHandleProps={readOnly ? undefined : { ...attributes, ...listeners }}
      />
    </li>
  );
}

type TaskCardContentProps = {
  task: SerializedTask;
  dragging?: boolean;
  readOnly?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  dragHandleProps?: Record<string, unknown>;
};

function TaskCardContent({
  task,
  dragging,
  readOnly,
  onEdit,
  onDelete,
  dragHandleProps
}: TaskCardContentProps) {
  return (
    <div
      className="group flex items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface-2 p-3"
      style={dragging ? { boxShadow: "var(--shadow-lg)" } : undefined}
    >
      {!readOnly ? (
        <button
          type="button"
          aria-label="Drag to move task"
          className="grid size-8 shrink-0 cursor-grab touch-none place-items-center self-center rounded-md text-subtle transition-colors hover:bg-surface-3 hover:text-muted active:cursor-grabbing"
          {...dragHandleProps}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path
              d="M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.4"
              strokeLinecap="round"
            />
          </svg>
        </button>
      ) : null}

      <button
        type="button"
        onClick={onEdit}
        disabled={!onEdit}
        className="flex min-w-0 flex-1 flex-col items-start gap-1 text-left disabled:cursor-default"
      >
        <span className="w-full truncate font-semibold text-text">{task.title}</span>
        <span className="flex items-center gap-2">
          {task.dueDate ? (
            <span className="text-[0.78rem] tabular text-subtle">{task.dueDate.slice(0, 10)}</span>
          ) : null}
          {task.description ? (
            <span
              className="size-1.5 rounded-full bg-accent"
              aria-label="Has description"
              title="Has description"
            />
          ) : null}
        </span>
      </button>

      {!readOnly && onDelete ? (
        <button
          type="button"
          aria-label={`Delete ${task.title}`}
          onClick={onDelete}
          className="shrink-0 rounded-md px-1.5 text-lg leading-none text-subtle opacity-0 transition hover:text-text group-hover:opacity-100 focus-visible:opacity-100"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
