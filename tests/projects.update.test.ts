import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { BillingPlan, PrismaClient, ProjectStatus, UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { PATCH } from "@/app/api/projects/[id]/route";

const prisma = new PrismaClient();

const fixture = {
  org: "test-update-org",
  otherOrg: "test-update-other-org",
  user: "test-update-user",
  project: "test-update-project",
  archived: "test-update-archived",
  foreign: "test-update-foreign"
};

async function resetFixture() {
  await cleanupFixture();

  await prisma.organization.createMany({
    data: [
      { id: fixture.org, name: "Update Org", slug: "test-update-org", plan: BillingPlan.PRO },
      {
        id: fixture.otherOrg,
        name: "Other Org",
        slug: "test-update-other-org",
        plan: BillingPlan.PRO
      }
    ]
  });

  await prisma.user.create({
    data: {
      id: fixture.user,
      email: "updater@test.example",
      name: "Updater",
      role: UserRole.ADMIN,
      organizationId: fixture.org
    }
  });

  await prisma.project.createMany({
    data: [
      {
        id: fixture.project,
        name: "Editable",
        status: ProjectStatus.ACTIVE,
        organizationId: fixture.org
      },
      {
        id: fixture.archived,
        name: "Frozen",
        status: ProjectStatus.ARCHIVED,
        organizationId: fixture.org
      },
      {
        id: fixture.foreign,
        name: "Not Yours",
        status: ProjectStatus.ACTIVE,
        organizationId: fixture.otherOrg
      }
    ]
  });
}

async function cleanupFixture() {
  await prisma.project.deleteMany({
    where: { organizationId: { in: [fixture.org, fixture.otherOrg] } }
  });
  await prisma.user.deleteMany({
    where: { organizationId: { in: [fixture.org, fixture.otherOrg] } }
  });
  await prisma.organization.deleteMany({
    where: { id: { in: [fixture.org, fixture.otherOrg] } }
  });
}

describe("project update", () => {
  beforeEach(async () => {
    await resetFixture();
  });

  afterAll(async () => {
    await cleanupFixture();
    await prisma.$disconnect();
  });

  it("renames and re-statuses a project", async () => {
    const response = await requestUpdate(fixture.user, fixture.project, {
      name: "  Renamed  ",
      status: ProjectStatus.PAUSED
    });
    const body = (await response.json()) as {
      project: { name: string; status: ProjectStatus };
    };

    expect(response.status).toBe(200);
    expect(body.project.name).toBe("Renamed");
    expect(body.project.status).toBe(ProjectStatus.PAUSED);
  });

  it("allows archiving a live project", async () => {
    const response = await requestUpdate(fixture.user, fixture.project, {
      name: "Editable",
      status: ProjectStatus.ARCHIVED
    });
    const body = (await response.json()) as { project: { status: ProjectStatus } };

    expect(response.status).toBe(200);
    expect(body.project.status).toBe(ProjectStatus.ARCHIVED);
  });

  it("refuses to edit an archived project (terminal state)", async () => {
    const response = await requestUpdate(fixture.user, fixture.archived, {
      name: "Trying To Revive",
      status: ProjectStatus.ACTIVE
    });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/archived/i);

    // Confirm nothing changed in the database.
    const stored = await prisma.project.findUnique({ where: { id: fixture.archived } });
    expect(stored?.status).toBe(ProjectStatus.ARCHIVED);
    expect(stored?.name).toBe("Frozen");
  });

  it("does not allow editing a project from another organization", async () => {
    const response = await requestUpdate(fixture.user, fixture.foreign, {
      name: "Hijacked",
      status: ProjectStatus.PAUSED
    });

    expect(response.status).toBe(404);

    const stored = await prisma.project.findUnique({ where: { id: fixture.foreign } });
    expect(stored?.name).toBe("Not Yours");
  });

  it("rejects an empty name", async () => {
    const response = await requestUpdate(fixture.user, fixture.project, {
      name: "   ",
      status: ProjectStatus.ACTIVE
    });

    expect(response.status).toBe(400);
  });
});

function requestUpdate(userId: string, projectId: string, body: Record<string, unknown>) {
  return PATCH(
    new NextRequest(`http://localhost/api/projects/${projectId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId
      },
      body: JSON.stringify(body)
    }),
    { params: Promise.resolve({ id: projectId }) }
  );
}
