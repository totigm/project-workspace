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
