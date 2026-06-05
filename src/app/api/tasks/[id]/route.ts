import { NextRequest, NextResponse } from "next/server";
import { getRequestUserId, readJsonBody } from "@/lib/request-helpers";
import {
  deleteTaskForUser,
  editTaskForUser,
  InvalidTaskInputError,
  moveTaskForUser,
  TaskNotFoundError
} from "@/lib/tasks";
import { serializeTask } from "@/lib/serialize";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const userId = getRequestUserId(request);
  const { id } = await context.params;

  try {
    const body = await readJsonBody(request);
    // A body carrying `position` is a board move; otherwise it's a field edit.
    const task =
      "position" in body
        ? await moveTaskForUser(userId, id, body)
        : await editTaskForUser(userId, id, body);
    return NextResponse.json({ task: serializeTask(task) });
  } catch (error) {
    if (error instanceof InvalidTaskInputError || error instanceof TaskNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update task" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const userId = getRequestUserId(request);
  const { id } = await context.params;

  try {
    await deleteTaskForUser(userId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof TaskNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete task" },
      { status: 500 }
    );
  }
}
