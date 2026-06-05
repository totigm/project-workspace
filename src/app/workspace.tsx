"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { CreateProjectForm, type CreateResult } from "@/app/create-project-form";
import { EditProjectModal, type SaveResult } from "@/app/edit-project-modal";
import { ProjectsPanel } from "@/app/projects-panel";
import { PlanPill, StatCard } from "@/app/stat-card";
import { ThemeToggle } from "@/app/theme-toggle";
import { UpgradeModal } from "@/app/upgrade-modal";
import { UserSwitcher } from "@/app/user-switcher";
import { useToast } from "@/app/toast";

export type ClientProject = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
};

type WorkspaceProps = {
  orgName: string;
  userName: string;
  activeUserId: string;
  users: { id: string; label: string }[];
  plan: string;
  freeLimit: number;
  initialProjects: ClientProject[];
};

export function Workspace({
  orgName,
  userName,
  activeUserId,
  users,
  plan,
  freeLimit,
  initialProjects
}: WorkspaceProps) {
  const router = useRouter();
  const toast = useToast();
  const [projects, setProjects] = useState(initialProjects);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [editing, setEditing] = useState<ClientProject | null>(null);
  const [isSwitching, startSwitch] = useTransition();

  // Re-seed from the server when the active user changes (account switch).
  const seedRef = useRef(initialProjects);
  seedRef.current = initialProjects;
  useEffect(() => {
    setProjects(seedRef.current);
  }, [activeUserId]);

  const isFree = plan.toUpperCase() === "FREE";
  // Archived projects are a soft-delete and don't count toward the plan limit.
  const liveCount = useMemo(
    () => projects.filter((p) => p.status.toUpperCase() !== "ARCHIVED").length,
    [projects]
  );

  function setBusy(id: string, on: boolean) {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function switchUser(id: string) {
    startSwitch(() => router.push(`/?userId=${id}`));
  }

  async function createProject(name: string, status: string): Promise<CreateResult> {
    const tempId = `temp-${Date.now()}`;
    const optimistic: ClientProject = {
      id: tempId,
      name,
      status,
      createdAt: new Date().toISOString()
    };
    setProjects((prev) => [...prev, optimistic]);
    setBusy(tempId, true);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": activeUserId },
        body: JSON.stringify({ name, status })
      });

      if (response.status === 403) {
        setProjects((prev) => prev.filter((p) => p.id !== tempId));
        setUpgradeOpen(true);
        return "limit";
      }

      const payload = (await response.json()) as {
        project?: { id: string; name: string; status: string };
        error?: string;
      };

      if (!response.ok || !payload.project) {
        setProjects((prev) => prev.filter((p) => p.id !== tempId));
        toast({
          title: "Couldn't create project",
          description: payload.error ?? "Something went wrong. Please try again.",
          variant: "error"
        });
        return "error";
      }

      const created = payload.project;
      setProjects((prev) =>
        prev.map((p) => (p.id === tempId ? { ...p, id: created.id, name: created.name, status: created.status } : p))
      );
      toast({ title: "Project created", description: `“${created.name}” is live.`, variant: "success" });
      return "ok";
    } catch {
      setProjects((prev) => prev.filter((p) => p.id !== tempId));
      toast({ title: "Network error", description: "Couldn't reach the server.", variant: "error" });
      return "error";
    } finally {
      setBusy(tempId, false);
    }
  }

  async function changeStatus(id: string, nextStatus: string) {
    const target = projects.find((p) => p.id === id);
    if (!target) return;
    const previous = target.status;
    const archiving = nextStatus.toUpperCase() === "ARCHIVED";

    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, status: nextStatus } : p)));
    setBusy(id, true);

    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-user-id": activeUserId },
        body: JSON.stringify({ name: target.name, status: nextStatus })
      });
      const payload = (await response.json()) as {
        project?: { status: string };
        error?: string;
      };

      if (!response.ok || !payload.project) {
        setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, status: previous } : p)));
        toast({
          title: "Couldn't update project",
          description: payload.error ?? "Please try again.",
          variant: "error"
        });
        return;
      }

      if (archiving) {
        toast({ title: "Project archived", description: `“${target.name}” was archived.`, variant: "info" });
      }
    } catch {
      setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, status: previous } : p)));
      toast({ title: "Network error", description: "Couldn't reach the server.", variant: "error" });
    } finally {
      setBusy(id, false);
    }
  }

  // Full edit (rename + status) from the edit modal — optimistic, with revert.
  async function saveProject(id: string, name: string, status: string): Promise<SaveResult> {
    const target = projects.find((p) => p.id === id);
    if (!target) return "error";
    const previous = { name: target.name, status: target.status };
    const archiving =
      status.toUpperCase() === "ARCHIVED" && previous.status.toUpperCase() !== "ARCHIVED";

    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name, status } : p)));
    setBusy(id, true);

    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-user-id": activeUserId },
        body: JSON.stringify({ name, status })
      });
      const payload = (await response.json()) as {
        project?: { name: string; status: string };
        error?: string;
      };

      if (!response.ok || !payload.project) {
        setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...previous } : p)));
        toast({
          title: "Couldn't save changes",
          description: payload.error ?? "Please try again.",
          variant: "error"
        });
        return "error";
      }

      toast(
        archiving
          ? { title: "Project archived", description: `“${name}” was archived.`, variant: "info" }
          : { title: "Changes saved", description: `“${name}” was updated.`, variant: "success" }
      );
      return "ok";
    } catch {
      setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...previous } : p)));
      toast({ title: "Network error", description: "Couldn't reach the server.", variant: "error" });
      return "error";
    } finally {
      setBusy(id, false);
    }
  }

  return (
    <>
      <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-2 text-[0.72rem] font-bold uppercase tracking-[0.14em] text-accent-ink">
            Workspace
          </p>
          <h1 className="text-[clamp(2rem,5vw,3rem)] font-extrabold leading-[1.02] tracking-tight text-text">
            {orgName}
          </h1>
          <p className="mt-2 text-sm text-muted">
            Signed in as <span className="font-semibold text-text">{userName}</span>
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <UserSwitcher users={users} activeId={activeUserId} onSelect={switchUser} />
          <ThemeToggle />
        </div>
      </header>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr]">
        <StatCard count={liveCount} />
        <div className="flex sm:justify-end">
          <PlanPill plan={plan} />
        </div>
      </div>

      <div className="mb-5">
        <CreateProjectForm
          isFree={isFree}
          used={liveCount}
          freeLimit={freeLimit}
          onCreate={createProject}
        />
      </div>

      <ProjectsPanel
        projects={projects}
        busyIds={busyIds}
        loading={isSwitching}
        onChangeStatus={changeStatus}
        onEdit={setEditing}
      />

      <UpgradeModal
        open={upgradeOpen}
        used={Math.max(liveCount, freeLimit)}
        limit={freeLimit}
        onClose={() => setUpgradeOpen(false)}
        onUpgrade={() => {
          setUpgradeOpen(false);
          toast({
            title: "Upgrade flow coming soon",
            description: "Pro billing isn't wired up in this demo yet.",
            variant: "info"
          });
        }}
      />

      <EditProjectModal
        open={editing !== null}
        project={editing}
        onClose={() => setEditing(null)}
        onSave={saveProject}
      />
    </>
  );
}
