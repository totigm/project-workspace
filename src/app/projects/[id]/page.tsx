import { notFound } from "next/navigation";
import { DEFAULT_USER_ID } from "@/lib/current-user";
import { getProjectForUser, ProjectNotFoundError } from "@/lib/projects";
import { serializeTask } from "@/lib/serialize";
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
    <main className="shell">
      <section className="header">
        <div>
          <p className="eyebrow">
            <a className="back-link" href={`/?userId=${userId}`}>
              ← {project.organization.name}
            </a>
          </p>
          <h1>{project.name}</h1>
          <p className="subtle">
            <span className={`status status-${project.status.toLowerCase()}`}>
              {project.status.toLowerCase()}
            </span>
          </p>
        </div>
        <ProjectActions
          userId={userId}
          projectId={project.id}
          name={project.name}
          status={project.status}
        />
      </section>

      <TaskBoard
        userId={userId}
        projectId={project.id}
        initialTasks={initialTasks}
        readOnly={isArchived}
      />
    </main>
  );
}
