import { DEFAULT_USER_ID, requireCurrentUser } from "@/lib/current-user";
import { FREE_PROJECT_LIMIT, listProjectsForUser } from "@/lib/projects";
import { CreateProjectForm } from "@/app/create-project-form";

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
        projectCount={projects.length}
        freeLimit={FREE_PROJECT_LIMIT}
      />

      <section className="project-list" aria-label="Projects">
        <table>
          <thead>
            <tr>
              <th scope="col">Project</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id}>
                <td>{project.name}</td>
                <td>
                  <span className={`status status-${project.status.toLowerCase()}`}>
                    {project.status.toLowerCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
