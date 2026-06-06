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

  it("creates a task in the requested column when a status is given", async () => {
    const todo = await createTaskForUser(f.user, f.project, { title: "T" });
    const doing = await createTaskForUser(f.user, f.project, {
      title: "D",
      status: TaskStatus.DOING
    });
    expect(todo.status).toBe(TaskStatus.TODO);
    expect(doing.status).toBe(TaskStatus.DOING);
    // Position is counted per column, so the first DOING task starts at 0.
    expect(doing.position).toBe(0);
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
