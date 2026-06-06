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
