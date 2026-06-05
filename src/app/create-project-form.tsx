"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { UpgradeModal } from "@/app/upgrade-modal";

type CreateProjectFormProps = {
  userId: string;
  plan: string;
  projectCount: number;
  freeLimit: number;
};

export function CreateProjectForm({
  userId,
  plan,
  projectCount,
  freeLimit
}: CreateProjectFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const isFree = plan.toUpperCase() === "FREE";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    const response = await fetch("/api/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId
      },
      body: JSON.stringify({ name, status })
    });
    const payload = (await response.json()) as { error?: string };

    setIsSubmitting(false);

    // 403 from the API means the org hit its plan's project ceiling — surface the
    // upgrade moment instead of a plain inline error.
    if (response.status === 403) {
      setShowUpgrade(true);
      return;
    }

    if (!response.ok) {
      setMessage(payload.error ?? "Unable to create project.");
      return;
    }

    setName("");
    setStatus("ACTIVE");
    setMessage("Project created.");
    router.refresh();
  }

  return (
    <>
      <form className="create-project" onSubmit={onSubmit}>
        <div>
          <p className="form-title">New project</p>
          <label htmlFor="project-name">Name</label>
          <input
            id="project-name"
            name="name"
            onChange={(event) => setName(event.target.value)}
            placeholder="Q3 launch"
            type="text"
            value={name}
          />
        </div>
        <div>
          <label htmlFor="project-status">Status</label>
          <select
            id="project-status"
            name="status"
            onChange={(event) => setStatus(event.target.value)}
            value={status}
          >
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
        <button disabled={isSubmitting} type="submit">
          {isSubmitting ? "Creating..." : "Create"}
        </button>
        {isFree ? (
          <p className="form-hint">
            Free plan &mdash; {projectCount}/{freeLimit} active projects used
          </p>
        ) : null}
        {message ? <p className="form-message">{message}</p> : null}
      </form>

      <UpgradeModal
        open={showUpgrade}
        used={Math.max(projectCount, freeLimit)}
        limit={freeLimit}
        onClose={() => setShowUpgrade(false)}
      />
    </>
  );
}
