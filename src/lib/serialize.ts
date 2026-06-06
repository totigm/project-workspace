import { Task } from "@prisma/client";

export function serializeTask(task: Task) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    status: task.status,
    position: task.position,
    projectId: task.projectId
  };
}

export type SerializedTask = ReturnType<typeof serializeTask>;
