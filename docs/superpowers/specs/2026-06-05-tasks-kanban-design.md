# Wave 1 — Tasks inside Projects (Kanban) + Project Lifecycle

**Date:** 2026-06-05
**Branch:** `feat/wave1-tasks-kanban` (off `feat/project-plan-limits-editing-and-tabs`)
**Status:** Approved design — ready for implementation plan

## Goal

Give projects depth so the app earns a daily-use loop. Today a project is just a
name + status with nothing inside it. This wave adds **tasks inside a project**,
shown on a **project detail page** as a **kanban board**, plus the **project
lifecycle actions** (rename / archive / delete) that the detail page is the
natural home for.

This is the keystone of a three-wave roadmap:
- **Wave 1 (this spec):** tasks + detail page + lifecycle → retention loop.
- **Wave 2 (later):** real auth, invites, task assignment, activity feed.
- **Wave 3 (later):** close the billing loop (real checkout / usage).

## Scope

**In scope**
- `Task` model (rich: title, description, due date, status) + `TaskStatus` enum.
- Project detail page at `/projects/[id]` with a 3-column kanban (Todo/Doing/Done).
- Drag-to-move tasks between/within columns (via `smooth-drag-drop` skill /
  framer-motion `Reorder`), persisted optimistically.
- Task CRUD: create, edit (title/description/due date), move (status+position), delete.
- Project lifecycle: rename, change status (incl. archive), **delete** (with confirm).
- React Query (`@tanstack/react-query`) for fetching + optimistic mutations.
- Home project rows link into the detail page.
- Tests (Vitest) for the task lib + project lifecycle lib (matching existing style).

**Out of scope (deferred)**
- Assignees → Wave 2 (needs real auth).
- Task-count paywall → Wave 3 monetization hook.
- Search / filter / sort of tasks.
- Project **project-limit** logic stays as-is (already implemented in the WIP we
  branched from: archive-aware count, archived = soft delete, FREE = 3 active).

## Pre-existing WIP we build on

The branch already contains (uncommitted) lifecycle/limits/tabs work:
- `projects.ts`: `updateProjectForUser` (rename + status, "archived is terminal/frozen"),
  `ProjectNotFoundError`, archive-aware plan limits.
- `PATCH /api/projects/[id]` route.
- UI: `modal.tsx` (generic), `edit-project-modal.tsx`, `project-list.tsx`,
  `request-helpers.ts`, `upgrade-modal.tsx`.
- Tests: `projects.update.test.ts`, additions to `projects.creation.test.ts`.

We reuse `modal.tsx`, `request-helpers.ts`, and the existing error classes rather
than duplicating them.

## Data model (Prisma)

```prisma
enum TaskStatus { TODO  DOING  DONE }

model Task {
  id          String     @id @default(cuid())
  title       String
  description String?
  dueDate     DateTime?
  status      TaskStatus @default(TODO)
  position    Int                        // order within its status column
  projectId   String
  project     Project    @relation(fields: [projectId], references: [id], onDelete: Cascade)
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  @@index([projectId])
}
```

`Project` gains `tasks Task[]`. Deleting a project cascades to its tasks.
`position` is an integer ordering within a status column; a move writes the
card's new `status` + `position`, and the server reflows the affected column(s)
so positions stay contiguous.

## API surface (REST, consumed via React Query)

| Method + path                     | Purpose                                   | Errors |
|-----------------------------------|-------------------------------------------|--------|
| `GET /api/projects/[id]`          | project + its tasks                       | 404 cross-org/missing |
| `PATCH /api/projects/[id]`        | rename / change status (archive) *(exists)* | 400 / 404 |
| `DELETE /api/projects/[id]`       | delete project (cascades tasks)           | 404 |
| `POST /api/projects/[id]/tasks`   | create task                               | 400 / 404 |
| `PATCH /api/tasks/[id]`           | edit fields **or** move (status+position) | 400 / 404 |
| `DELETE /api/tasks/[id]`          | delete task                               | 404 |

**Authorization:** every route resolves current user → org and verifies the
project/task belongs to that org. Cross-org access returns **404** (don't leak
existence) — same spirit as `requireCurrentUser`. Routes stay thin; logic lives
in the lib layer.

## Core logic layer

- New `src/lib/tasks.ts` mirroring `projects.ts`: input parsing/validation
  (`InvalidTaskInputError` → 400), org-scoped authorization helpers, and the
  move/reflow logic. This is the **tested core**.
- Extend `src/lib/projects.ts` with `getProjectForUser` (project + tasks) and
  `deleteProjectForUser`. Reuse existing `updateProjectForUser`.

## Client architecture

- React Query provider added in `layout.tsx`.
- Board uses `useQuery` for tasks and `useMutation` with **optimistic updates +
  rollback** for create/move/edit/delete.
- Drag handled via the `smooth-drag-drop` skill (framer-motion `Reorder`),
  cross-column moves supported; on drop, fire the move mutation. Honors
  `prefers-reduced-motion`. Adds `framer-motion` + `@tanstack/react-query` deps.

## Project detail page — `/projects/[id]`

- Header: inline-editable name; status control (incl. Archive); **delete** button
  with a confirm step (reuse `modal.tsx`).
- Body: three columns (Todo / Doing / Done), each with an "add task" affordance
  and a friendly empty state.
- Card: title + due-date badge + a description indicator; clicking a card opens an
  edit panel (reuse `modal.tsx`) for full description / due date.
- Home `project-list` rows become links into this page.

## Error handling

- Validation → 400 with message; authorization/missing → 404.
- Optimistic mutations roll back on failure and surface an inline error.
- Archived projects: tasks are read-only (consistent with "archived is frozen").

## Testing (Vitest, matching `projects.creation.test.ts` style)

- `tasks.*.test.ts`:
  - create + validation (title required, length bounds, status default).
  - move + column reflow (positions stay contiguous; cross-column move).
  - edit fields; delete.
  - cross-org denial (404) for get/create/edit/move/delete.
- `projects.*` additions:
  - `getProjectForUser` returns tasks, org-scoped.
  - `deleteProjectForUser` cascades tasks + cross-org denial.
- Keep the existing 12 tests green.

## Success criteria

1. A user opens a project, sees three columns, adds tasks, drags them between
   columns, edits and deletes them — persisted across refresh.
2. A user renames, archives, and deletes a project from its detail page.
3. All authorization is org-scoped; cross-org access returns 404.
4. Full Vitest suite green (existing + new); `tsc --noEmit` clean.
