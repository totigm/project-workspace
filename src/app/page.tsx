import { ProjectStatus } from "@prisma/client";
import { DEFAULT_USER_ID, requireCurrentUser } from "@/lib/current-user";
import { FREE_PROJECT_LIMIT, listProjectsForUser } from "@/lib/projects";
import { CreateProjectForm } from "@/app/create-project-form";
import { ProjectList } from "@/app/project-list";

type HomeProps = {
  searchParams?: Promise<{
    userId?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const userId = params?.userId ?? DEFAULT_USER_ID;
  const [currentUser, projects] = await Promise.all([
    requireCurrentUser(userId),
    listProjectsForUser(userId)
  ]);

  // Only live (non-archived) projects count toward the plan limit.
  const activeCount = projects.filter(
    (project) => project.status !== ProjectStatus.ARCHIVED
  ).length;
  const slimProjects = projects.map((project) => ({
    id: project.id,
    name: project.name,
    status: project.status
  }));

  return (
    <main className="shell">
      <section className="header">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>{currentUser.organization.name}</h1>
          <p className="subtle">Signed in as {currentUser.name}</p>
        </div>
        <nav className="user-switcher" aria-label="Switch current user">
          <a className={userId === "user-ana" ? "active" : ""} href="/?userId=user-ana">
            Ana
          </a>
          <a className={userId === "user-ben" ? "active" : ""} href="/?userId=user-ben">
            Ben
          </a>
        </nav>
      </section>

      <section className="toolbar">
        <div>
          <span className="metric">{projects.length}</span>
          <span className="subtle">projects</span>
        </div>
        <div className="plan-pill">
          <span>Plan</span>
          <strong>{currentUser.organization.plan.toLowerCase()}</strong>
        </div>
      </section>

      <CreateProjectForm
        userId={userId}
        plan={currentUser.organization.plan}
        projectCount={activeCount}
        freeLimit={FREE_PROJECT_LIMIT}
      />

      <ProjectList userId={userId} projects={slimProjects} />
    </main>
  );
}
