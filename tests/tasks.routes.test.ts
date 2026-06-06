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
