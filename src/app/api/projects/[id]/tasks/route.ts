import { NextRequest, NextResponse } from "next/server";
import { getRequestUserId, readJsonBody } from "@/lib/request-helpers";
import { createTaskForUser, InvalidTaskInputError, TaskNotFoundError } from "@/lib/tasks";
import { serializeTask } from "@/lib/serialize";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const userId = getRequestUserId(request);
  const { id } = await context.params;

  try {
    const body = await readJsonBody(request);
    const task = await createTaskForUser(userId, id, body);
    return NextResponse.json({ task: serializeTask(task) }, { status: 201 });
  } catch (error) {
    if (error instanceof InvalidTaskInputError || error instanceof TaskNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create task" },
      { status: 500 }
    );
  }
}
