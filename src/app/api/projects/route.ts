import { NextRequest, NextResponse } from "next/server";
import {
  createProjectForUser,
  InvalidProjectInputError,
  ProjectLimitReachedError,
  listProjectsForUser
} from "@/lib/projects";
import { getRequestUserId, readJsonBody } from "@/lib/request-helpers";

export async function GET(request: NextRequest) {
  const userId = getRequestUserId(request);

  try {
    const projects = await listProjectsForUser(userId);

    return NextResponse.json({
      userId,
      projects: projects.map((project) => ({
        id: project.id,
        name: project.name,
        status: project.status,
        organizationId: project.organizationId,
        organizationName: project.organization.name
      }))
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load projects"
      },
      { status: 404 }
    );
  }
}

export async function POST(request: NextRequest) {
  const userId = getRequestUserId(request);

  try {
    const body = await readJsonBody(request);
    const project = await createProjectForUser(userId, body);

    return NextResponse.json(
      {
        project: {
          id: project.id,
          name: project.name,
          status: project.status,
          organizationId: project.organizationId,
          organizationName: project.organization.name
        }
      },
      { status: 201 }
    );
  } catch (error) {
    if (
      error instanceof InvalidProjectInputError ||
      error instanceof ProjectLimitReachedError
    ) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to create project"
      },
      { status: 500 }
    );
  }
}
