import { BillingPlan, Prisma, ProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";

const projectStatuses = new Set<string>(Object.values(ProjectStatus));

// Maximum number of projects an organization may have per billing plan.
// `null` means unlimited.
export const PROJECT_LIMITS: Record<BillingPlan, number | null> = {
  [BillingPlan.FREE]: 3,
  [BillingPlan.PRO]: null
};

// Convenience export for UI that needs to show the free ceiling.
export const FREE_PROJECT_LIMIT = PROJECT_LIMITS[BillingPlan.FREE] as number;

export class InvalidProjectInputError extends Error {
  statusCode = 400;
}

export class ProjectLimitReachedError extends Error {
  statusCode = 403;
}

export class ProjectNotFoundError extends Error {
  statusCode = 404;
}

export async function listProjectsForUser(userId: string) {
  const currentUser = await requireCurrentUser(userId);

  return prisma.project.findMany({
    where: {
      organizationId: currentUser.organizationId
    },
    include: {
      organization: true
    },
    orderBy: {
      name: "asc"
    }
  });
}

type CreateProjectInput = {
  name?: unknown;
  status?: unknown;
};

export async function createProjectForUser(userId: string, input: CreateProjectInput) {
  const currentUser = await requireCurrentUser(userId);
  const name = parseProjectName(input.name);
  const status = parseProjectStatus(input.status);

  return prisma.$transaction(async (tx) => {
    // Take a per-organization advisory lock so the limit check and the insert
    // are atomic. Without it, two concurrent creates could both read a count
    // below the limit and both insert, pushing the org over its ceiling. The
    // lock is scoped per org (so unrelated orgs don't serialize) and released
    // automatically when the transaction ends.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`project-limit:${currentUser.organizationId}`}))`;

    await assertProjectLimitNotReached(
      tx,
      currentUser.organizationId,
      currentUser.organization.plan
    );

    return tx.project.create({
      data: {
        name,
        status,
        organizationId: currentUser.organizationId
      },
      include: {
        organization: true
      }
    });
  });
}

async function assertProjectLimitNotReached(
  client: Prisma.TransactionClient,
  organizationId: string,
  plan: BillingPlan
) {
  const limit = PROJECT_LIMITS[plan];

  if (limit === null) {
    return;
  }

  // Archived projects are a soft-delete and don't count against the plan limit —
  // only live (active/paused) projects do.
  const activeCount = await client.project.count({
    where: {
      organizationId,
      status: { not: ProjectStatus.ARCHIVED }
    }
  });

  if (activeCount >= limit) {
    throw new ProjectLimitReachedError(
      `Your ${plan.toLowerCase()} plan is limited to ${limit} active projects. Archive one or upgrade to add more.`
    );
  }
}

type UpdateProjectInput = {
  name?: unknown;
  status?: unknown;
};

export async function updateProjectForUser(
  userId: string,
  projectId: string,
  input: UpdateProjectInput
) {
  const currentUser = await requireCurrentUser(userId);

  const existing = await prisma.project.findUnique({
    where: { id: projectId }
  });

  // Scope to the caller's organization so users can't edit other orgs' projects.
  if (!existing || existing.organizationId !== currentUser.organizationId) {
    throw new ProjectNotFoundError("Project not found.");
  }

  // Archiving is a terminal soft-delete: archived projects are frozen and can't
  // be renamed or moved back to another status.
  if (existing.status === ProjectStatus.ARCHIVED) {
    throw new InvalidProjectInputError("Archived projects can no longer be edited.");
  }

  const name = parseProjectName(input.name);
  const status = parseProjectStatus(input.status);

  return prisma.project.update({
    where: { id: projectId },
    data: { name, status },
    include: {
      organization: true
    }
  });
}

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

function parseProjectName(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new InvalidProjectInputError("Project name is required.");
  }

  const name = value.trim();

  if (name.length > 80) {
    throw new InvalidProjectInputError("Project name must be 80 characters or fewer.");
  }

  return name;
}

function parseProjectStatus(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return ProjectStatus.ACTIVE;
  }

  if (typeof value !== "string" || !projectStatuses.has(value)) {
    throw new InvalidProjectInputError("Project status is invalid.");
  }

  return value as ProjectStatus;
}
