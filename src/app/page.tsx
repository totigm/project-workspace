import { DEFAULT_USER_ID, requireCurrentUser } from "@/lib/current-user";
import { FREE_PROJECT_LIMIT, listProjectsForUser } from "@/lib/projects";
import { Workspace, type ClientProject } from "@/app/workspace";

type HomeProps = {
  searchParams?: Promise<{
    userId?: string;
  }>;
};

const USERS = [
  { id: "user-ana", label: "Ana" },
  { id: "user-ben", label: "Ben" }
];

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const userId = params?.userId ?? DEFAULT_USER_ID;
  const [currentUser, projects] = await Promise.all([
    requireCurrentUser(userId),
    listProjectsForUser(userId)
  ]);

  const initialProjects: ClientProject[] = projects.map((project) => ({
    id: project.id,
    name: project.name,
    status: project.status,
    createdAt: project.createdAt.toISOString()
  }));

  return (
    <main className="relative z-10 mx-auto w-[min(1040px,calc(100%-2rem))] py-12 sm:py-16">
      <Workspace
        orgName={currentUser.organization.name}
        userName={currentUser.name}
        activeUserId={userId}
        users={USERS}
        plan={currentUser.organization.plan}
        freeLimit={FREE_PROJECT_LIMIT}
        initialProjects={initialProjects}
      />
    </main>
  );
}
