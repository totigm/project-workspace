import { NextRequest } from "next/server";
import { DEFAULT_USER_ID } from "@/lib/current-user";
import { InvalidProjectInputError } from "@/lib/projects";

export function getRequestUserId(request: NextRequest) {
  return (
    request.headers.get("x-user-id") ??
    request.nextUrl.searchParams.get("userId") ??
    DEFAULT_USER_ID
  );
}

export async function readJsonBody(request: NextRequest): Promise<Record<string, unknown>> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new InvalidProjectInputError("Request body must be valid JSON.");
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new InvalidProjectInputError("Request body must be a JSON object.");
  }

  return body as Record<string, unknown>;
}
