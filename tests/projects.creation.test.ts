import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { BillingPlan, PrismaClient, ProjectStatus, UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/projects/route";

const prisma = new PrismaClient();

const fixture = {
  org: "test-create-org",
  user: "test-create-user"
};

async function resetFixture() {
  await cleanupFixture();

  await prisma.organization.create({
    data: {
      id: fixture.org,
      name: "Create Test Org",
      slug: "test-create-org",
      plan: BillingPlan.FREE
    }
  });

  await prisma.user.create({
    data: {
      id: fixture.user,
      email: "creator@test.example",
      name: "Creator",
      role: UserRole.ADMIN,
      organizationId: fixture.org
    }
  });

  await prisma.project.createMany({
    data: [
      {
        id: "test-create-existing-1",
        name: "Existing One",
        status: ProjectStatus.ACTIVE,
        organizationId: fixture.org
      },
      {
        id: "test-create-existing-2",
        name: "Existing Two",
        status: ProjectStatus.PAUSED,
        organizationId: fixture.org
      }
    ]
  });
}

async function cleanupFixture() {
  await prisma.project.deleteMany({
    where: {
      organizationId: fixture.org
    }
  });

  await prisma.user.deleteMany({
    where: {
      organizationId: fixture.org
    }
  });

  await prisma.organization.deleteMany({
    where: {
      id: fixture.org
    }
  });
}

describe("project creation", () => {
  beforeEach(async () => {
    await resetFixture();
  });

  afterAll(async () => {
    await cleanupFixture();
    await prisma.$disconnect();
  });

  it("creates projects in the selected user's organization", async () => {
    const response = await requestCreateProject(fixture.user, {
      name: "  New Launch  ",
      status: ProjectStatus.ACTIVE
    });
    const body = (await response.json()) as {
      project: {
        name: string;
        status: ProjectStatus;
        organizationId: string;
      };
    };

    expect(response.status).toBe(201);
    expect(body.project.name).toBe("New Launch");
    expect(body.project.status).toBe(ProjectStatus.ACTIVE);
    expect(body.project.organizationId).toBe(fixture.org);
  });

  it("rejects empty project names", async () => {
    const response = await requestCreateProject(fixture.user, {
      name: "   "
    });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Project name is required.");
  });

  it("allows free orgs to reach the 3 project limit", async () => {
    // Fixture starts with 2 projects; the 3rd should still be allowed.
    const response = await requestCreateProject(fixture.user, {
      name: "Third Project"
    });

    expect(response.status).toBe(201);
  });

  it("blocks free orgs from exceeding the 3 project limit", async () => {
    await requestCreateProject(fixture.user, { name: "Third Project" });

    const response = await requestCreateProject(fixture.user, {
      name: "Fourth Project"
    });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(403);
    expect(body.error).toMatch(/limited to 3 projects/);
  });

  it("lets pro orgs create beyond the free limit", async () => {
    await prisma.organization.update({
      where: { id: fixture.org },
      data: { plan: BillingPlan.PRO }
    });

    await requestCreateProject(fixture.user, { name: "Third Project" });
    const response = await requestCreateProject(fixture.user, {
      name: "Fourth Project"
    });

    expect(response.status).toBe(201);
  });
});

function requestCreateProject(userId: string, body: Record<string, unknown>) {
  return POST(
    new NextRequest("http://localhost/api/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId
      },
      body: JSON.stringify(body)
    })
  );
}
