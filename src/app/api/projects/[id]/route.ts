import { NextRequest, NextResponse } from "next/server";
import {
  deleteProjectForUser,
  getProjectForUser,
  InvalidProjectInputError,
  ProjectNotFoundError,
  updateProjectForUser
} from "@/lib/projects";
import { getRequestUserId, readJsonBody } from "@/lib/request-helpers";
import { serializeTask } from "@/lib/serialize";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const userId = getRequestUserId(request);
  const { id } = await context.params;

  try {
    const body = await readJsonBody(request);
    const project = await updateProjectForUser(userId, id, body);

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        status: project.status,
        organizationId: project.organizationId,
        organizationName: project.organization.name
      }
    });
  } catch (error) {
    if (
      error instanceof InvalidProjectInputError ||
      error instanceof ProjectNotFoundError
    ) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to update project"
      },
      { status: 500 }
    );
  }
}

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
