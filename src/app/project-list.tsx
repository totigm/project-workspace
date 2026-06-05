"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { EditableProject, EditProjectModal } from "@/app/edit-project-modal";

type ProjectListProps = {
  userId: string;
  projects: EditableProject[];
};

const TABS = [
  { key: "ACTIVE", label: "Active" },
  { key: "PAUSED", label: "Paused" },
  { key: "ARCHIVED", label: "Archived" }
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function ProjectList({ userId, projects }: ProjectListProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("ACTIVE");
  const [editing, setEditing] = useState<EditableProject | null>(null);

  const counts = useMemo(() => {
    return projects.reduce<Record<string, number>>((acc, project) => {
      acc[project.status] = (acc[project.status] ?? 0) + 1;
      return acc;
    }, {});
  }, [projects]);

  const visibleProjects = projects.filter((project) => project.status === activeTab);

  return (
    <section className="project-list" aria-label="Projects">
      <div className="project-tabs" role="tablist" aria-label="Filter projects by status">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            type="button"
            id={`tab-${tab.key.toLowerCase()}`}
            aria-selected={activeTab === tab.key}
            aria-controls="project-tabpanel"
            className="project-tab"
            data-active={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            <span className="project-tab-count">{counts[tab.key] ?? 0}</span>
          </button>
        ))}
      </div>

      <div id="project-tabpanel" role="tabpanel" aria-labelledby={`tab-${activeTab.toLowerCase()}`}>
        {visibleProjects.length === 0 ? (
          <p className="project-empty">No {activeTab.toLowerCase()} projects.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">Project</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleProjects.map((project) => (
                <tr key={project.id}>
                  <td>
                    <a className="project-name-link" href={`/projects/${project.id}?userId=${userId}`}>
                      {project.name}
                    </a>
                  </td>
                  <td>
                    <span className={`status status-${project.status.toLowerCase()}`}>
                      {project.status.toLowerCase()}
                    </span>
                  </td>
                  <td className="row-actions">
                    {project.status === "ARCHIVED" ? (
                      <span className="row-locked">
                        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                          <path
                            d="M7 10V7a5 5 0 0 1 10 0v3M6 10h12v9H6z"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        Locked
                      </span>
                    ) : (
                      <button
                        className="row-edit"
                        type="button"
                        onClick={() => setEditing(project)}
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <EditProjectModal
        open={editing !== null}
        project={editing}
        userId={userId}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          router.refresh();
        }}
      />
    </section>
  );
}
