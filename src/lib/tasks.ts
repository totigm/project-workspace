import { ProjectStatus, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";

const taskStatuses = new Set<string>(Object.values(TaskStatus));
const TITLE_MAX = 120;
const DESCRIPTION_MAX = 2000;

export class InvalidTaskInputError extends Error {
  statusCode = 400;
}

export class TaskNotFoundError extends Error {
  statusCode = 404;
}

// Loads a project and asserts it belongs to the caller's org. Throws
// TaskNotFoundError (404) for missing OR cross-org projects so existence
// never leaks across organizations.
async function requireOwnedProject(userId: string, projectId: string) {
  const currentUser = await requireCurrentUser(userId);
  const project = await prisma.project.findUnique({ where: { id: projectId } });

  if (!project || project.organizationId !== currentUser.organizationId) {
    throw new TaskNotFoundError("Project not found.");
  }

  return project;
}

type CreateTaskInput = {
  title?: unknown;
  description?: unknown;
  dueDate?: unknown;
};

export async function createTaskForUser(
  userId: string,
  projectId: string,
  input: CreateTaskInput
) {
  const project = await requireOwnedProject(userId, projectId);

  if (project.status === ProjectStatus.ARCHIVED) {
    throw new InvalidTaskInputError("Archived projects are read-only.");
  }

  const title = parseTitle(input.title);
  const description = parseDescription(input.description);
  const dueDate = parseDueDate(input.dueDate);

  // New tasks land at the end of the TODO column.
  const count = await prisma.task.count({
    where: { projectId, status: TaskStatus.TODO }
  });

  return prisma.task.create({
    data: { title, description, dueDate, status: TaskStatus.TODO, position: count, projectId }
  });
}

function parseTitle(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new InvalidTaskInputError("Task title is required.");
  }
  const title = value.trim();
  if (title.length > TITLE_MAX) {
    throw new InvalidTaskInputError(`Task title must be ${TITLE_MAX} characters or fewer.`);
  }
  return title;
}

function parseDescription(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    throw new InvalidTaskInputError("Task description must be text.");
  }
  const description = value.trim();
  if (description.length === 0) {
    return null;
  }
  if (description.length > DESCRIPTION_MAX) {
    throw new InvalidTaskInputError(`Task description must be ${DESCRIPTION_MAX} characters or fewer.`);
  }
  return description;
}

function parseDueDate(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    throw new InvalidTaskInputError("Task due date must be an ISO date string.");
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new InvalidTaskInputError("Task due date is invalid.");
  }
  return date;
}

// Exported for reuse by later tasks (move/edit).
export { requireOwnedProject, taskStatuses };
