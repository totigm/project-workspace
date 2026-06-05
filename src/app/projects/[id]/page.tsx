import { notFound } from "next/navigation";
import { DEFAULT_USER_ID } from "@/lib/current-user";
import { getProjectForUser, ProjectNotFoundError } from "@/lib/projects";
import { serializeTask } from "@/lib/serialize";
import { StatusBadge } from "@/app/status-badge";
import { TaskBoard } from "@/app/projects/[id]/task-board";
import { ProjectActions } from "@/app/projects/[id]/project-actions";

export const dynamic = "force-dynamic";

type DetailProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ userId?: string }>;
};

export default async function ProjectDetail({ params, searchParams }: DetailProps) {
  const { id } = await params;
  const sp = await searchParams;
  const userId = sp?.userId ?? DEFAULT_USER_ID;

  let project;
  try {
    project = await getProjectForUser(userId, id);
  } catch (error) {
    if (error instanceof ProjectNotFoundError) {
      notFound();
    }
    throw error;
  }

  const initialTasks = project.tasks.map(serializeTask);
  const isArchived = project.status === "ARCHIVED";

  return (
    <main className="relative z-10 mx-auto w-[min(1040px,calc(100%-2rem))] py-12 sm:py-16">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <a
            href={`/?userId=${userId}`}
            className="inline-flex items-center gap-1.5 text-[0.72rem] font-bold uppercase tracking-[0.14em] text-accent-ink transition-colors hover:text-text"
          >
            <span aria-hidden="true">←</span>
            {project.organization.name}
          </a>
          <h1 className="mt-2 truncate text-[clamp(2rem,5vw,3rem)] font-extrabold leading-[1.05] tracking-tight text-text">
            {project.name}
          </h1>
          <div className="mt-3">
            <StatusBadge status={project.status} />
          </div>
        </div>
        <ProjectActions
          userId={userId}
          projectId={project.id}
          name={project.name}
          status={project.status}
          createdAt={project.createdAt.toISOString()}
        />
      </header>

      <div className="mt-10">
        <TaskBoard
          userId={userId}
          projectId={project.id}
          initialTasks={initialTasks}
          readOnly={isArchived}
        />
      </div>
    </main>
  );
}
