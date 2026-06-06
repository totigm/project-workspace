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
