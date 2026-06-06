# Tasks Kanban + Project Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Two skills to consult during execution:** `smooth-drag-drop` (Task 11, the kanban board) and `data-fetching` (Task 9–11, React Query patterns). Invoke them at those tasks.

**Goal:** Give projects depth — a project detail page with a draggable kanban of tasks (Todo/Doing/Done) plus rename/archive/delete lifecycle actions.

**Architecture:** Logic lives in a tested lib layer (`src/lib/tasks.ts`, extensions to `src/lib/projects.ts`); thin REST routes wrap it; the client uses React Query for fetching + optimistic mutations and framer-motion `Reorder` for drag. Authorization is org-scoped everywhere (cross-org → 404).

**Tech Stack:** Next.js 15 (App Router), React 19, Prisma 6 / Postgres, Vitest, `@tanstack/react-query`, `framer-motion`.

**Conventions carried from the existing code:**
- Lib functions take `userId` first, call `requireCurrentUser`, and scope every query to `currentUser.organizationId`.
- Error classes carry a `statusCode`; routes translate them to responses.
- Tests use a direct `PrismaClient`, explicit fixture ids prefixed per-suite, `beforeEach` reset + `afterAll` cleanup/disconnect, and call route handlers directly with a `NextRequest` and `{ params: Promise.resolve(...) }`.
- DB runs on `localhost:5490` (see `.env`); `npm test` runs the suite; `npm run typecheck` runs `tsc --noEmit`.

---

## File Structure

**Create:**
- `src/lib/tasks.ts` — task logic: create / edit / move (with reflow) / delete, validation, org-scoped auth, `InvalidTaskInputError`, `TaskNotFoundError`.
- `src/app/api/projects/[id]/tasks/route.ts` — `POST` create task.
- `src/app/api/tasks/[id]/route.ts` — `PATCH` (edit or move) + `DELETE`.
- `src/app/providers.tsx` — React Query `QueryClientProvider` (client component).
- `src/app/projects/[id]/page.tsx` — server component: fetch project + tasks, render board.
- `src/app/projects/[id]/task-board.tsx` — client kanban (React Query + framer-motion).
- `src/app/projects/[id]/task-modal.tsx` — create/edit task dialog (reuses `Modal`).
- `src/app/projects/[id]/project-actions.tsx` — rename/archive/delete header controls.
- `tests/tasks.create.test.ts`, `tests/tasks.move.test.ts`, `tests/tasks.edit-delete.test.ts`, `tests/projects.detail-delete.test.ts`.

**Modify:**
- `prisma/schema.prisma` — add `TaskStatus` enum, `Task` model, `Project.tasks`.
- `src/lib/projects.ts` — add `getProjectForUser` (project + tasks) and `deleteProjectForUser`.
- `src/app/api/projects/[id]/route.ts` — add `GET` (project + tasks) and `DELETE`.
- `src/app/layout.tsx` — wrap children in `<Providers>`.
- `src/app/project-list.tsx` — make the project name a link to `/projects/[id]`.
- `src/app/globals.css` — board, card, and detail-page styles.

---

## Task 1: Add the Task model + migration

**Files:**
- Modify: `prisma/schema.prisma`
- (DB migration generated under `prisma/migrations/`)

- [ ] **Step 1: Add the enum + model to the schema**

In `prisma/schema.prisma`, add `tasks Task[]` to the `Project` model (after `organization` relation line), and append:

```prisma
model Task {
  id          String     @id @default(cuid())
  title       String
  description String?
  dueDate     DateTime?
  status      TaskStatus @default(TODO)
  position    Int
  projectId   String
  project     Project    @relation(fields: [projectId], references: [id], onDelete: Cascade)
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@index([projectId])
}

enum TaskStatus {
  TODO
  DOING
  DONE
}
```

- [ ] **Step 2: Create + apply the migration and regenerate the client**

Run: `npx prisma migrate dev --name add_tasks`
Expected: a new migration folder is created and applied; `Task` table exists. Prisma Client regenerates.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no usages yet; `Task`/`TaskStatus` now exist on `@prisma/client`).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): add Task model and TaskStatus enum"
```

---

## Task 2: `createTaskForUser` — create + validation

**Files:**
- Create: `src/lib/tasks.ts`
- Test: `tests/tasks.create.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { BillingPlan, PrismaClient, ProjectStatus, TaskStatus, UserRole } from "@prisma/client";
import { createTaskForUser, InvalidTaskInputError, TaskNotFoundError } from "@/lib/tasks";

const prisma = new PrismaClient();

const f = {
  org: "test-task-org",
  otherOrg: "test-task-other",
  user: "test-task-user",
  project: "test-task-project",
  archived: "test-task-archived",
  foreign: "test-task-foreign"
};

async function reset() {
  await cleanup();
  await prisma.organization.createMany({
    data: [
      { id: f.org, name: "Task Org", slug: f.org, plan: BillingPlan.PRO },
      { id: f.otherOrg, name: "Other", slug: f.otherOrg, plan: BillingPlan.PRO }
    ]
  });
  await prisma.user.create({
    data: { id: f.user, email: "t@test.example", name: "T", role: UserRole.ADMIN, organizationId: f.org }
  });
  await prisma.project.createMany({
    data: [
      { id: f.project, name: "P", status: ProjectStatus.ACTIVE, organizationId: f.org },
      { id: f.archived, name: "A", status: ProjectStatus.ARCHIVED, organizationId: f.org },
      { id: f.foreign, name: "F", status: ProjectStatus.ACTIVE, organizationId: f.otherOrg }
    ]
  });
}

async function cleanup() {
  await prisma.task.deleteMany({ where: { project: { organizationId: { in: [f.org, f.otherOrg] } } } });
  await prisma.project.deleteMany({ where: { organizationId: { in: [f.org, f.otherOrg] } } });
  await prisma.user.deleteMany({ where: { organizationId: { in: [f.org, f.otherOrg] } } });
  await prisma.organization.deleteMany({ where: { id: { in: [f.org, f.otherOrg] } } });
}

describe("createTaskForUser", () => {
  beforeEach(reset);
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("creates a TODO task appended to the end of the column", async () => {
    const first = await createTaskForUser(f.user, f.project, { title: "  First  " });
    const second = await createTaskForUser(f.user, f.project, { title: "Second" });
    expect(first.title).toBe("First");
    expect(first.status).toBe(TaskStatus.TODO);
    expect(first.position).toBe(0);
    expect(second.position).toBe(1);
  });

  it("rejects an empty title", async () => {
    await expect(createTaskForUser(f.user, f.project, { title: "   " })).rejects.toBeInstanceOf(
      InvalidTaskInputError
    );
  });

  it("refuses to add tasks to an archived project", async () => {
    await expect(createTaskForUser(f.user, f.archived, { title: "x" })).rejects.toBeInstanceOf(
      InvalidTaskInputError
    );
  });

  it("treats another org's project as not found", async () => {
    await expect(createTaskForUser(f.user, f.foreign, { title: "x" })).rejects.toBeInstanceOf(
      TaskNotFoundError
    );
  });
});
```

- [ ] **Step 2: Run it — expect failure**

Run: `npx vitest run tests/tasks.create.test.ts`
Expected: FAIL (`@/lib/tasks` does not exist).

- [ ] **Step 3: Implement `src/lib/tasks.ts`**

```typescript
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
```

- [ ] **Step 4: Run it — expect pass**

Run: `npx vitest run tests/tasks.create.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tasks.ts tests/tasks.create.test.ts
git commit -m "feat(tasks): createTaskForUser with validation and org scoping"
```

---

## Task 3: `moveTaskForUser` — move + column reflow

**Files:**
- Modify: `src/lib/tasks.ts`
- Test: `tests/tasks.move.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { BillingPlan, PrismaClient, ProjectStatus, TaskStatus, UserRole } from "@prisma/client";
import { createTaskForUser, moveTaskForUser, TaskNotFoundError } from "@/lib/tasks";

const prisma = new PrismaClient();
const f = { org: "mv-org", other: "mv-other", user: "mv-user", project: "mv-project", foreignUser: "mv-fuser" };

async function reset() {
  await cleanup();
  await prisma.organization.createMany({
    data: [
      { id: f.org, name: "O", slug: f.org, plan: BillingPlan.PRO },
      { id: f.other, name: "X", slug: f.other, plan: BillingPlan.PRO }
    ]
  });
  await prisma.user.createMany({
    data: [
      { id: f.user, email: "mv@test.example", name: "U", role: UserRole.ADMIN, organizationId: f.org },
      { id: f.foreignUser, email: "mvf@test.example", name: "F", role: UserRole.ADMIN, organizationId: f.other }
    ]
  });
  await prisma.project.create({
    data: { id: f.project, name: "P", status: ProjectStatus.ACTIVE, organizationId: f.org }
  });
}

async function cleanup() {
  await prisma.task.deleteMany({ where: { project: { organizationId: { in: [f.org, f.other] } } } });
  await prisma.project.deleteMany({ where: { organizationId: { in: [f.org, f.other] } } });
  await prisma.user.deleteMany({ where: { organizationId: { in: [f.org, f.other] } } });
  await prisma.organization.deleteMany({ where: { id: { in: [f.org, f.other] } } });
}

async function column(status: TaskStatus) {
  const tasks = await prisma.task.findMany({
    where: { projectId: f.project, status },
    orderBy: { position: "asc" }
  });
  return tasks.map((t) => `${t.title}:${t.position}`);
}

describe("moveTaskForUser", () => {
  beforeEach(reset);
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("moves a task to another column and keeps both columns contiguous", async () => {
    const a = await createTaskForUser(f.user, f.project, { title: "A" }); // TODO:0
    const b = await createTaskForUser(f.user, f.project, { title: "B" }); // TODO:1
    await createTaskForUser(f.user, f.project, { title: "C" }); // TODO:2

    await moveTaskForUser(f.user, b.id, { status: TaskStatus.DOING, position: 0 });

    expect(await column(TaskStatus.TODO)).toEqual(["A:0", "C:1"]);
    expect(await column(TaskStatus.DOING)).toEqual(["B:0"]);

    await moveTaskForUser(f.user, a.id, { status: TaskStatus.DOING, position: 1 });
    expect(await column(TaskStatus.TODO)).toEqual(["C:0"]);
    expect(await column(TaskStatus.DOING)).toEqual(["B:0", "A:1"]);
  });

  it("reorders within the same column", async () => {
    const a = await createTaskForUser(f.user, f.project, { title: "A" });
    await createTaskForUser(f.user, f.project, { title: "B" });
    await createTaskForUser(f.user, f.project, { title: "C" });

    await moveTaskForUser(f.user, a.id, { status: TaskStatus.TODO, position: 2 });
    expect(await column(TaskStatus.TODO)).toEqual(["B:0", "C:1", "A:2"]);
  });

  it("clamps an out-of-range position to the end", async () => {
    const a = await createTaskForUser(f.user, f.project, { title: "A" });
    await createTaskForUser(f.user, f.project, { title: "B" });
    await moveTaskForUser(f.user, a.id, { status: TaskStatus.DONE, position: 99 });
    expect(await column(TaskStatus.DONE)).toEqual(["A:0"]);
    expect(await column(TaskStatus.TODO)).toEqual(["B:0"]);
  });

  it("treats another user's task as not found", async () => {
    const a = await createTaskForUser(f.user, f.project, { title: "A" });
    await expect(
      moveTaskForUser(f.foreignUser, a.id, { status: TaskStatus.DOING, position: 0 })
    ).rejects.toBeInstanceOf(TaskNotFoundError);
  });
});
```

- [ ] **Step 2: Run it — expect failure**

Run: `npx vitest run tests/tasks.move.test.ts`
Expected: FAIL (`moveTaskForUser` is not exported).

- [ ] **Step 3: Implement `moveTaskForUser` (append to `src/lib/tasks.ts`)**

Add this import-free code to the bottom of `src/lib/tasks.ts`:

```typescript
type MoveTaskInput = {
  status?: unknown;
  position?: unknown;
};

// Loads a task and asserts its project belongs to the caller's org. Throws
// TaskNotFoundError for missing OR cross-org tasks.
async function requireOwnedTask(userId: string, taskId: string) {
  const currentUser = await requireCurrentUser(userId);
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { project: true }
  });

  if (!task || task.project.organizationId !== currentUser.organizationId) {
    throw new TaskNotFoundError("Task not found.");
  }

  return task;
}

function parseStatus(value: unknown): TaskStatus {
  if (typeof value !== "string" || !taskStatuses.has(value)) {
    throw new InvalidTaskInputError("Task status is invalid.");
  }
  return value as TaskStatus;
}

function parsePosition(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new InvalidTaskInputError("Task position must be a non-negative integer.");
  }
  return value;
}

export async function moveTaskForUser(userId: string, taskId: string, input: MoveTaskInput) {
  const task = await requireOwnedTask(userId, taskId);

  if (task.project.status === ProjectStatus.ARCHIVED) {
    throw new InvalidTaskInputError("Archived projects are read-only.");
  }

  const targetStatus = parseStatus(input.status);
  const requestedPosition = parsePosition(input.position);
  const projectId = task.projectId;

  return prisma.$transaction(async (tx) => {
    // Rebuild the target column without the moved task, then splice it in.
    const target = (
      await tx.task.findMany({
        where: { projectId, status: targetStatus, id: { not: taskId } },
        orderBy: { position: "asc" }
      })
    ).map((t) => t.id);

    const index = Math.min(requestedPosition, target.length);
    target.splice(index, 0, taskId);

    for (let i = 0; i < target.length; i++) {
      await tx.task.update({
        where: { id: target[i] },
        data: { position: i, status: targetStatus }
      });
    }

    // If the task left its old column, reindex that column too.
    if (task.status !== targetStatus) {
      const source = await tx.task.findMany({
        where: { projectId, status: task.status, id: { not: taskId } },
        orderBy: { position: "asc" }
      });
      for (let i = 0; i < source.length; i++) {
        await tx.task.update({ where: { id: source[i].id }, data: { position: i } });
      }
    }

    return tx.task.findUniqueOrThrow({ where: { id: taskId } });
  });
}

// Exported for the API route discriminator + later tasks.
export { requireOwnedTask };
```

- [ ] **Step 4: Run it — expect pass**

Run: `npx vitest run tests/tasks.move.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tasks.ts tests/tasks.move.test.ts
git commit -m "feat(tasks): moveTaskForUser with column reflow"
```

---

## Task 4: `editTaskForUser` + `deleteTaskForUser`

**Files:**
- Modify: `src/lib/tasks.ts`
- Test: `tests/tasks.edit-delete.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { BillingPlan, PrismaClient, ProjectStatus, UserRole } from "@prisma/client";
import {
  createTaskForUser,
  deleteTaskForUser,
  editTaskForUser,
  InvalidTaskInputError,
  TaskNotFoundError
} from "@/lib/tasks";

const prisma = new PrismaClient();
const f = { org: "ed-org", other: "ed-other", user: "ed-user", fuser: "ed-fuser", project: "ed-project" };

async function reset() {
  await cleanup();
  await prisma.organization.createMany({
    data: [
      { id: f.org, name: "O", slug: f.org, plan: BillingPlan.PRO },
      { id: f.other, name: "X", slug: f.other, plan: BillingPlan.PRO }
    ]
  });
  await prisma.user.createMany({
    data: [
      { id: f.user, email: "ed@test.example", name: "U", role: UserRole.ADMIN, organizationId: f.org },
      { id: f.fuser, email: "edf@test.example", name: "F", role: UserRole.ADMIN, organizationId: f.other }
    ]
  });
  await prisma.project.create({
    data: { id: f.project, name: "P", status: ProjectStatus.ACTIVE, organizationId: f.org }
  });
}

async function cleanup() {
  await prisma.task.deleteMany({ where: { project: { organizationId: { in: [f.org, f.other] } } } });
  await prisma.project.deleteMany({ where: { organizationId: { in: [f.org, f.other] } } });
  await prisma.user.deleteMany({ where: { organizationId: { in: [f.org, f.other] } } });
  await prisma.organization.deleteMany({ where: { id: { in: [f.org, f.other] } } });
}

describe("edit + delete task", () => {
  beforeEach(reset);
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("edits title, description, and due date", async () => {
    const t = await createTaskForUser(f.user, f.project, { title: "Old" });
    const updated = await editTaskForUser(f.user, t.id, {
      title: "  New  ",
      description: "Details",
      dueDate: "2026-07-01"
    });
    expect(updated.title).toBe("New");
    expect(updated.description).toBe("Details");
    expect(updated.dueDate?.toISOString().slice(0, 10)).toBe("2026-07-01");
  });

  it("clears description and due date when given empty values", async () => {
    const t = await createTaskForUser(f.user, f.project, {
      title: "X",
      description: "d",
      dueDate: "2026-07-01"
    });
    const updated = await editTaskForUser(f.user, t.id, { description: "", dueDate: "" });
    expect(updated.description).toBeNull();
    expect(updated.dueDate).toBeNull();
  });

  it("rejects an empty title on edit", async () => {
    const t = await createTaskForUser(f.user, f.project, { title: "X" });
    await expect(editTaskForUser(f.user, t.id, { title: "  " })).rejects.toBeInstanceOf(
      InvalidTaskInputError
    );
  });

  it("deletes a task", async () => {
    const t = await createTaskForUser(f.user, f.project, { title: "X" });
    await deleteTaskForUser(f.user, t.id);
    expect(await prisma.task.findUnique({ where: { id: t.id } })).toBeNull();
  });

  it("treats another org's task as not found for edit and delete", async () => {
    const t = await createTaskForUser(f.user, f.project, { title: "X" });
    await expect(editTaskForUser(f.fuser, t.id, { title: "Y" })).rejects.toBeInstanceOf(
      TaskNotFoundError
    );
    await expect(deleteTaskForUser(f.fuser, t.id)).rejects.toBeInstanceOf(TaskNotFoundError);
  });
});
```

- [ ] **Step 2: Run it — expect failure**

Run: `npx vitest run tests/tasks.edit-delete.test.ts`
Expected: FAIL (`editTaskForUser` / `deleteTaskForUser` not exported).

- [ ] **Step 3: Implement (append to `src/lib/tasks.ts`)**

```typescript
type EditTaskInput = {
  title?: unknown;
  description?: unknown;
  dueDate?: unknown;
};

export async function editTaskForUser(userId: string, taskId: string, input: EditTaskInput) {
  const task = await requireOwnedTask(userId, taskId);

  if (task.project.status === ProjectStatus.ARCHIVED) {
    throw new InvalidTaskInputError("Archived projects are read-only.");
  }

  // Only update fields that were provided; "" clears description/dueDate.
  const data: { title?: string; description?: string | null; dueDate?: Date | null } = {};
  if (input.title !== undefined) {
    data.title = parseTitle(input.title);
  }
  if (input.description !== undefined) {
    data.description = parseDescription(input.description);
  }
  if (input.dueDate !== undefined) {
    data.dueDate = parseDueDate(input.dueDate);
  }

  return prisma.task.update({ where: { id: taskId }, data });
}

export async function deleteTaskForUser(userId: string, taskId: string) {
  const task = await requireOwnedTask(userId, taskId);
  await prisma.task.delete({ where: { id: taskId } });
  return task;
}
```

- [ ] **Step 4: Run it — expect pass**

Run: `npx vitest run tests/tasks.edit-delete.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tasks.ts tests/tasks.edit-delete.test.ts
git commit -m "feat(tasks): editTaskForUser and deleteTaskForUser"
```

---

## Task 5: `getProjectForUser` + `deleteProjectForUser` (projects.ts)

**Files:**
- Modify: `src/lib/projects.ts`
- Test: `tests/projects.detail-delete.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { BillingPlan, PrismaClient, ProjectStatus, TaskStatus, UserRole } from "@prisma/client";
import { deleteProjectForUser, getProjectForUser, ProjectNotFoundError } from "@/lib/projects";

const prisma = new PrismaClient();
const f = { org: "dp-org", other: "dp-other", user: "dp-user", fuser: "dp-fuser", project: "dp-project", foreign: "dp-foreign" };

async function reset() {
  await cleanup();
  await prisma.organization.createMany({
    data: [
      { id: f.org, name: "O", slug: f.org, plan: BillingPlan.PRO },
      { id: f.other, name: "X", slug: f.other, plan: BillingPlan.PRO }
    ]
  });
  await prisma.user.createMany({
    data: [
      { id: f.user, email: "dp@test.example", name: "U", role: UserRole.ADMIN, organizationId: f.org },
      { id: f.fuser, email: "dpf@test.example", name: "F", role: UserRole.ADMIN, organizationId: f.other }
    ]
  });
  await prisma.project.createMany({
    data: [
      { id: f.project, name: "P", status: ProjectStatus.ACTIVE, organizationId: f.org },
      { id: f.foreign, name: "F", status: ProjectStatus.ACTIVE, organizationId: f.other }
    ]
  });
  await prisma.task.createMany({
    data: [
      { id: "dp-t1", title: "T1", status: TaskStatus.TODO, position: 0, projectId: f.project },
      { id: "dp-t2", title: "T2", status: TaskStatus.DOING, position: 0, projectId: f.project }
    ]
  });
}

async function cleanup() {
  await prisma.task.deleteMany({ where: { project: { organizationId: { in: [f.org, f.other] } } } });
  await prisma.project.deleteMany({ where: { organizationId: { in: [f.org, f.other] } } });
  await prisma.user.deleteMany({ where: { organizationId: { in: [f.org, f.other] } } });
  await prisma.organization.deleteMany({ where: { id: { in: [f.org, f.other] } } });
}

describe("project detail + delete", () => {
  beforeEach(reset);
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("returns a project with its tasks ordered by position", async () => {
    const project = await getProjectForUser(f.user, f.project);
    expect(project.name).toBe("P");
    expect(project.tasks).toHaveLength(2);
    expect(project.tasks.map((t) => t.title)).toEqual(["T1", "T2"]);
  });

  it("treats another org's project as not found", async () => {
    await expect(getProjectForUser(f.user, f.foreign)).rejects.toBeInstanceOf(ProjectNotFoundError);
  });

  it("deletes a project and cascades its tasks", async () => {
    await deleteProjectForUser(f.user, f.project);
    expect(await prisma.project.findUnique({ where: { id: f.project } })).toBeNull();
    expect(await prisma.task.count({ where: { projectId: f.project } })).toBe(0);
  });

  it("does not delete another org's project", async () => {
    await expect(deleteProjectForUser(f.user, f.foreign)).rejects.toBeInstanceOf(ProjectNotFoundError);
    expect(await prisma.project.findUnique({ where: { id: f.foreign } })).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run it — expect failure**

Run: `npx vitest run tests/projects.detail-delete.test.ts`
Expected: FAIL (`getProjectForUser` / `deleteProjectForUser` not exported).

- [ ] **Step 3: Implement (add to `src/lib/projects.ts`)**

Add after `updateProjectForUser` (uses the existing `ProjectNotFoundError` + `requireCurrentUser`):

```typescript
export async function getProjectForUser(userId: string, projectId: string) {
  const currentUser = await requireCurrentUser(userId);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      organization: true,
      tasks: { orderBy: [{ status: "asc" }, { position: "asc" }] }
    }
  });

  if (!project || project.organizationId !== currentUser.organizationId) {
    throw new ProjectNotFoundError("Project not found.");
  }

  return project;
}

export async function deleteProjectForUser(userId: string, projectId: string) {
  const currentUser = await requireCurrentUser(userId);

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.organizationId !== currentUser.organizationId) {
    throw new ProjectNotFoundError("Project not found.");
  }

  // Tasks cascade via the schema relation.
  return prisma.project.delete({ where: { id: projectId } });
}
```

- [ ] **Step 4: Run it — expect pass**

Run: `npx vitest run tests/projects.detail-delete.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/projects.ts tests/projects.detail-delete.test.ts
git commit -m "feat(projects): getProjectForUser (with tasks) and deleteProjectForUser"
```

---

## Task 6: Task API routes (create / patch / delete) + project GET/DELETE

**Files:**
- Create: `src/app/api/projects/[id]/tasks/route.ts`
- Create: `src/app/api/tasks/[id]/route.ts`
- Modify: `src/app/api/projects/[id]/route.ts`
- Test: extend `tests/tasks.create.test.ts` with a route-level test, OR add `tests/tasks.routes.test.ts`

- [ ] **Step 1: Write the failing route test (`tests/tasks.routes.test.ts`)**

```typescript
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { BillingPlan, PrismaClient, ProjectStatus, TaskStatus, UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { POST as createTask } from "@/app/api/projects/[id]/tasks/route";
import { PATCH as patchTask, DELETE as deleteTask } from "@/app/api/tasks/[id]/route";
import { GET as getProject, DELETE as deleteProject } from "@/app/api/projects/[id]/route";

const prisma = new PrismaClient();
const f = { org: "rt-org", user: "rt-user", project: "rt-project" };

async function reset() {
  await cleanup();
  await prisma.organization.create({ data: { id: f.org, name: "O", slug: f.org, plan: BillingPlan.PRO } });
  await prisma.user.create({
    data: { id: f.user, email: "rt@test.example", name: "U", role: UserRole.ADMIN, organizationId: f.org }
  });
  await prisma.project.create({
    data: { id: f.project, name: "P", status: ProjectStatus.ACTIVE, organizationId: f.org }
  });
}

async function cleanup() {
  await prisma.task.deleteMany({ where: { project: { organizationId: f.org } } });
  await prisma.project.deleteMany({ where: { organizationId: f.org } });
  await prisma.user.deleteMany({ where: { organizationId: f.org } });
  await prisma.organization.deleteMany({ where: { id: f.org } });
}

function req(path: string, method: string, body?: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json", "x-user-id": f.user },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

describe("task + project detail routes", () => {
  beforeEach(reset);
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("creates, moves, lists, and deletes a task through the routes", async () => {
    const created = await createTask(req(`/api/projects/${f.project}/tasks`, "POST", { title: "A" }), {
      params: Promise.resolve({ id: f.project })
    });
    expect(created.status).toBe(201);
    const { task } = (await created.json()) as { task: { id: string; status: string } };
    expect(task.status).toBe(TaskStatus.TODO);

    const moved = await patchTask(req(`/api/tasks/${task.id}`, "PATCH", { status: "DOING", position: 0 }), {
      params: Promise.resolve({ id: task.id })
    });
    expect(moved.status).toBe(200);

    const got = await getProject(req(`/api/projects/${f.project}`, "GET"), {
      params: Promise.resolve({ id: f.project })
    });
    const detail = (await got.json()) as { project: { tasks: { status: string }[] } };
    expect(detail.project.tasks[0].status).toBe("DOING");

    const removed = await deleteTask(req(`/api/tasks/${task.id}`, "DELETE"), {
      params: Promise.resolve({ id: task.id })
    });
    expect(removed.status).toBe(200);
  });

  it("returns 400 for an invalid task and 404 for a missing project", async () => {
    const bad = await createTask(req(`/api/projects/${f.project}/tasks`, "POST", { title: "" }), {
      params: Promise.resolve({ id: f.project })
    });
    expect(bad.status).toBe(400);

    const missing = await getProject(req(`/api/projects/does-not-exist`, "GET"), {
      params: Promise.resolve({ id: "does-not-exist" })
    });
    expect(missing.status).toBe(404);
  });

  it("deletes a project through the route", async () => {
    const res = await deleteProject(req(`/api/projects/${f.project}`, "DELETE"), {
      params: Promise.resolve({ id: f.project })
    });
    expect(res.status).toBe(200);
    expect(await prisma.project.findUnique({ where: { id: f.project } })).toBeNull();
  });
});
```

- [ ] **Step 2: Run it — expect failure**

Run: `npx vitest run tests/tasks.routes.test.ts`
Expected: FAIL (route modules/handlers missing).

- [ ] **Step 3a: Create `src/app/api/projects/[id]/tasks/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getRequestUserId, readJsonBody } from "@/lib/request-helpers";
import { createTaskForUser, InvalidTaskInputError, TaskNotFoundError } from "@/lib/tasks";
import { serializeTask } from "@/lib/serialize";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const userId = getRequestUserId(request);
  const { id } = await context.params;

  try {
    const body = await readJsonBody(request);
    const task = await createTaskForUser(userId, id, body);
    return NextResponse.json({ task: serializeTask(task) }, { status: 201 });
  } catch (error) {
    if (error instanceof InvalidTaskInputError || error instanceof TaskNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create task" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3b: Create `src/lib/serialize.ts`** (shared serializer so dates cross the wire as ISO strings)

```typescript
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
```

- [ ] **Step 3c: Create `src/app/api/tasks/[id]/route.ts`** (PATCH discriminates move vs edit by presence of `position`)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getRequestUserId, readJsonBody } from "@/lib/request-helpers";
import {
  deleteTaskForUser,
  editTaskForUser,
  InvalidTaskInputError,
  moveTaskForUser,
  TaskNotFoundError
} from "@/lib/tasks";
import { serializeTask } from "@/lib/serialize";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const userId = getRequestUserId(request);
  const { id } = await context.params;

  try {
    const body = await readJsonBody(request);
    // A body carrying `position` is a board move; otherwise it's a field edit.
    const task =
      "position" in body
        ? await moveTaskForUser(userId, id, body)
        : await editTaskForUser(userId, id, body);
    return NextResponse.json({ task: serializeTask(task) });
  } catch (error) {
    if (error instanceof InvalidTaskInputError || error instanceof TaskNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update task" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const userId = getRequestUserId(request);
  const { id } = await context.params;

  try {
    await deleteTaskForUser(userId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof TaskNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete task" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3d: Add `GET` and `DELETE` to `src/app/api/projects/[id]/route.ts`**

Add these imports at the top alongside the existing ones:

```typescript
import {
  deleteProjectForUser,
  getProjectForUser,
  ProjectNotFoundError
} from "@/lib/projects";
import { serializeTask } from "@/lib/serialize";
```

Then add the handlers (the file already exports `PATCH`):

```typescript
export async function GET(request: NextRequest, context: RouteContext) {
  const userId = getRequestUserId(request);
  const { id } = await context.params;

  try {
    const project = await getProjectForUser(userId, id);
    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        status: project.status,
        organizationId: project.organizationId,
        organizationName: project.organization.name,
        tasks: project.tasks.map(serializeTask)
      }
    });
  } catch (error) {
    if (error instanceof ProjectNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load project" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const userId = getRequestUserId(request);
  const { id } = await context.params;

  try {
    await deleteProjectForUser(userId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ProjectNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete project" },
      { status: 500 }
    );
  }
}
```

> NOTE: ensure `getRequestUserId`/`readJsonBody` are imported in `projects/[id]/route.ts` (they already are, from the WIP). `RouteContext` is already defined there.

- [ ] **Step 4: Run it — expect pass + full suite**

Run: `npx vitest run tests/tasks.routes.test.ts`
Expected: PASS (3 tests).
Run: `npm test`
Expected: all suites green (existing 12 + new).

- [ ] **Step 5: Commit**

```bash
git add src/app/api src/lib/serialize.ts tests/tasks.routes.test.ts
git commit -m "feat(api): task routes + project GET/DELETE"
```

---

## Task 7: React Query provider

**Files:**
- Create: `src/app/providers.tsx`
- Modify: `src/app/layout.tsx`

> CONSULT the `data-fetching` skill for the canonical React Query App-Router setup.

- [ ] **Step 1: Add the dependency**

Run: `npm install @tanstack/react-query`
Expected: package added to `dependencies`.

- [ ] **Step 2: Create `src/app/providers.tsx`**

```typescript
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";

export function Providers({ children }: { children: ReactNode }) {
  // One client per browser session; created lazily so it isn't shared across requests on the server.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } }
      })
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 3: Wrap children in `src/app/layout.tsx`**

Import `Providers` and wrap the existing `{children}` inside `<body>`:

```tsx
import { Providers } from "@/app/providers";
// ...
<body className={/* existing */}>
  <Providers>{children}</Providers>
</body>
```

- [ ] **Step 4: Verify build typechecks**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/app/providers.tsx src/app/layout.tsx
git commit -m "feat(client): add React Query provider"
```

---

## Task 8: Project detail page (server component)

**Files:**
- Create: `src/app/projects/[id]/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { notFound } from "next/navigation";
import { DEFAULT_USER_ID } from "@/lib/current-user";
import { getProjectForUser, ProjectNotFoundError } from "@/lib/projects";
import { serializeTask } from "@/lib/serialize";
import { TaskBoard } from "@/app/projects/[id]/task-board";
import { ProjectActions } from "@/app/projects/[id]/project-actions";

export const dynamic = "force-dynamic";

type DetailProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ userId?: string }>;
};

export default async function ProjectDetail({ params, searchParams }: DetailProps) {
  const { id } = await params;
  const sp = await searchParams;
  const userId = sp?.userId ?? DEFAULT_USER_ID;

  let project;
  try {
    project = await getProjectForUser(userId, id);
  } catch (error) {
    if (error instanceof ProjectNotFoundError) {
      notFound();
    }
    throw error;
  }

  const initialTasks = project.tasks.map(serializeTask);
  const isArchived = project.status === "ARCHIVED";

  return (
    <main className="shell">
      <section className="header">
        <div>
          <p className="eyebrow">
            <a className="back-link" href={`/?userId=${userId}`}>
              ← {project.organization.name}
            </a>
          </p>
          <h1>{project.name}</h1>
          <p className="subtle">
            <span className={`status status-${project.status.toLowerCase()}`}>
              {project.status.toLowerCase()}
            </span>
          </p>
        </div>
        <ProjectActions
          userId={userId}
          projectId={project.id}
          name={project.name}
          status={project.status}
        />
      </section>

      <TaskBoard
        userId={userId}
        projectId={project.id}
        initialTasks={initialTasks}
        readOnly={isArchived}
      />
    </main>
  );
}
```

- [ ] **Step 2: Typecheck (will fail until Task 9–10 create the imports)**

Run: `npm run typecheck`
Expected: FAIL with "Cannot find module './task-board'/'./project-actions'". This is expected — they are built next. Do NOT commit yet.

> This page is committed together with Task 9 + 10 since they are interdependent imports.

---

## Task 9: Task board (kanban + React Query + drag)

**Files:**
- Create: `src/app/projects/[id]/task-board.tsx`
- Create: `src/app/projects/[id]/task-modal.tsx`

> CONSULT BOTH skills here: `smooth-drag-drop` for the framer-motion `Reorder` cross-column recipe, and `data-fetching` for React Query optimistic mutations. The code below is a complete, working baseline; refine animation polish per `smooth-drag-drop`.

- [ ] **Step 1: Add the dependency**

Run: `npm install framer-motion`
Expected: package added to `dependencies`.

- [ ] **Step 2: Create `src/app/projects/[id]/task-modal.tsx`**

```tsx
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
```

- [ ] **Step 3: Create `src/app/projects/[id]/task-board.tsx`**

```tsx
"use client";

import { useMemo, useState } from "react";
import { Reorder } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SerializedTask } from "@/lib/serialize";
import { TaskDraft, TaskModal } from "@/app/projects/[id]/task-modal";

const COLUMNS = [
  { status: "TODO", label: "Todo" },
  { status: "DOING", label: "Doing" },
  { status: "DONE", label: "Done" }
] as const;

type TaskBoardProps = {
  userId: string;
  projectId: string;
  initialTasks: SerializedTask[];
  readOnly: boolean;
};

const headers = (userId: string) => ({ "Content-Type": "application/json", "x-user-id": userId });

export function TaskBoard({ userId, projectId, initialTasks, readOnly }: TaskBoardProps) {
  const queryClient = useQueryClient();
  const queryKey = ["project-tasks", projectId];

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

  function handleReorder(status: string, reordered: SerializedTask[]) {
    // Find the card whose position/column changed and persist it.
    reordered.forEach((task, index) => {
      if (task.status !== status || task.position !== index) {
        moveMutation.mutate({ id: task.id, status, position: index });
      }
    });
  }

  return (
    <section className="board" aria-label="Task board">
      {COLUMNS.map((col) => (
        <div className="board-col" key={col.status}>
          <header className="board-col-head">
            <h2>{col.label}</h2>
            <span className="board-col-count">{byColumn[col.status].length}</span>
          </header>

          <Reorder.Group
            axis="y"
            values={byColumn[col.status]}
            onReorder={(items) => !readOnly && handleReorder(col.status, items as SerializedTask[])}
            className="board-col-list"
          >
            {byColumn[col.status].map((task) => (
              <Reorder.Item key={task.id} value={task} className="task-card" drag={!readOnly}>
                <button className="task-card-main" type="button" onClick={() => setEditing(task)}>
                  <span className="task-card-title">{task.title}</span>
                  {task.dueDate ? (
                    <span className="task-card-due">{task.dueDate.slice(0, 10)}</span>
                  ) : null}
                  {task.description ? <span className="task-card-note" aria-hidden="true" /> : null}
                </button>
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
      ))}

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
```

> NOTE: The simple `handleReorder` persists per-card moves; cross-column drag with framer-motion `Reorder` across separate groups needs the `smooth-drag-drop` recipe (a shared drag context or drop-zone detection). Use that skill to wire cross-column drops; within-column reorder works with the code above. If cross-column drag proves fiddly, an accepted fallback is a small "move to column" control on each card that calls `moveMutation` — confirm with reviewer.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS once `task-board` + `task-modal` exist (page.tsx imports resolve; `project-actions` still pending — built in Task 10).

---

## Task 10: Project lifecycle actions (detail header)

**Files:**
- Create: `src/app/projects/[id]/project-actions.tsx`

- [ ] **Step 1: Create the component (reuses existing `EditProjectModal` + `Modal`)**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/app/modal";
import { EditProjectModal } from "@/app/edit-project-modal";

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
        project={isArchived ? null : { id: projectId, name, status: status as never }}
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
```

> NOTE: confirm `EditProjectModal`'s `project` prop shape against `src/app/edit-project-modal.tsx` (it exports `EditableProject`). Import and use that type instead of `as never` if the shapes differ — read the file during execution and adapt.

- [ ] **Step 2: Typecheck — now page.tsx fully resolves**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit Tasks 8–10 together**

```bash
git add package.json package-lock.json src/app/projects src/app/providers.tsx src/app/layout.tsx
git commit -m "feat(ui): project detail page with kanban board and lifecycle actions"
```

---

## Task 11: Link project rows into the detail page

**Files:**
- Modify: `src/app/project-list.tsx`

- [ ] **Step 1: Make the project name a link**

In `src/app/project-list.tsx`, change the name cell from plain text to a link (keep the Edit action as-is):

```tsx
<td>
  <a className="project-name-link" href={`/projects/${project.id}?userId=${userId}`}>
    {project.name}
  </a>
</td>
```

- [ ] **Step 2: Typecheck + run dev to click through**

Run: `npm run typecheck` → PASS.
Run: `npm run dev`, open `/`, click a project name → lands on the detail board.

- [ ] **Step 3: Commit**

```bash
git add src/app/project-list.tsx
git commit -m "feat(ui): link project rows to detail page"
```

---

## Task 12: Board + detail styles

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Append board styles**

Add styles for the new classes used above. Keep the existing visual language (spacing, status pills, modal card). Minimum set:

```css
.board { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
.board-col { background: var(--surface, #f5f5f7); border-radius: 12px; padding: 0.75rem; }
.board-col-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
.board-col-count { font-variant-numeric: tabular-nums; opacity: 0.6; }
.board-col-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; min-height: 2rem; }
.task-card { display: flex; align-items: center; gap: 0.5rem; background: white; border: 1px solid rgba(0,0,0,0.08); border-radius: 10px; padding: 0.6rem 0.75rem; cursor: grab; }
.task-card:active { cursor: grabbing; }
.task-card-main { flex: 1; display: flex; flex-direction: column; align-items: flex-start; gap: 0.25rem; background: none; border: 0; text-align: left; cursor: pointer; }
.task-card-title { font-weight: 500; }
.task-card-due { font-size: 0.75rem; opacity: 0.7; }
.task-card-note { width: 6px; height: 6px; border-radius: 50%; background: currentColor; opacity: 0.4; }
.task-card-delete { background: none; border: 0; font-size: 1.1rem; line-height: 1; opacity: 0.4; cursor: pointer; }
.task-card-delete:hover { opacity: 1; }
.board-add { margin-top: 0.5rem; width: 100%; }
.board-empty { opacity: 0.5; font-size: 0.85rem; padding: 0.5rem; }
.task-form { display: flex; flex-direction: column; gap: 0.4rem; }
.task-form input, .task-form textarea { width: 100%; }
.task-form-actions { display: flex; gap: 0.5rem; margin-top: 0.75rem; }
.detail-actions { display: flex; gap: 0.5rem; }
.danger { color: #b00020; }
.back-link { text-decoration: none; }
.project-name-link { text-decoration: none; font-weight: 500; }
.confirm { display: flex; flex-direction: column; gap: 0.5rem; }
@media (max-width: 720px) { .board { grid-template-columns: 1fr; } }
@media (prefers-reduced-motion: reduce) { .task-card { transition: none !important; } }
```

- [ ] **Step 2: Visual check**

Run: `npm run dev`, open a project, confirm three columns, drag a card, add/edit/delete, delete a project.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "style: kanban board and project detail styles"
```

---

## Task 13: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all suites green (original 12 + new task/project suites).

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Manual smoke (dev server)**

Run: `npm run dev`. Verify the success criteria:
1. Open a project → 3 columns; add tasks; drag between columns; edit; delete — persists across refresh.
2. Rename, archive, delete a project from its detail page.
3. Visit a project id from another org (`?userId=user-ben` on a Nimbus project) → 404.

- [ ] **Step 4: Commit any final touch-ups, then hand off**

Use `superpowers:finishing-a-development-branch` to decide merge/PR back into `feat/project-plan-limits-editing-and-tabs`.

---

## Self-Review (author checklist — completed)

- **Spec coverage:** Task model (T1), tasks lib create/move/edit/delete (T2–4), project get+delete (T5), API routes (T6), React Query (T7), detail page (T8), kanban board (T9), lifecycle actions inc. delete (T10), row links (T11), styles (T12), verification (T13). All spec sections mapped.
- **Deferred items honored:** no assignees, no task paywall, no search — none introduced.
- **Type consistency:** `SerializedTask` defined in `src/lib/serialize.ts` (T6) and consumed by board/modal (T9); `createTaskForUser`/`moveTaskForUser`/`editTaskForUser`/`deleteTaskForUser` names consistent across lib (T2–4), routes (T6), and tests; `requireOwnedProject`/`requireOwnedTask` exported where reused.
- **Known soft spot:** cross-column framer-motion drag (T9) — flagged with `smooth-drag-drop` consult + a documented fallback. Not a placeholder; a real decision deferred to execution with a concrete alternative.
- **Auth:** every lib function org-scopes and throws the 404-mapped not-found error; route tests assert 400/404.
