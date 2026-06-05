"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { StatusBadge } from "@/app/status-badge";
import type { ClientProject } from "@/app/workspace";

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC"
});

type ProjectRowProps = {
  userId: string;
  project: ClientProject;
  busy: boolean;
  onChangeStatus: (id: string, status: string) => void;
  onEdit: (project: ClientProject) => void;
};

export function ProjectRow({ userId, project, busy, onChangeStatus, onEdit }: ProjectRowProps) {
  const status = project.status.toUpperCase();
  const isArchived = status === "ARCHIVED";
  const created = DATE_FMT.format(new Date(project.createdAt));

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: busy ? 0.55 : 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 380, damping: 34 }}
      className="group grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 border-t border-border px-4 py-3.5 first:border-t-0 sm:grid-cols-[1fr_8.5rem_auto] sm:px-5"
    >
      {/* Name + (mobile) date */}
      <div className="min-w-0">
        <Link
          href={`/projects/${project.id}?userId=${userId}`}
          className="block truncate font-semibold text-text underline-offset-4 transition-colors hover:text-accent-ink hover:underline"
        >
          {project.name}
        </Link>
        <p className="mt-0.5 text-[0.78rem] text-subtle sm:hidden">Created {created}</p>
      </div>

      {/* Date (desktop column) */}
      <p className="hidden text-[0.82rem] text-muted sm:block">{created}</p>

      {/* Status + actions */}
      <div className="col-start-2 row-start-1 flex items-center justify-end gap-2 sm:col-start-3">
        <StatusBadge status={project.status} />
        {isArchived ? (
          <span
            className="grid size-8 place-items-center text-subtle"
            title="Archived projects are frozen"
            aria-label="Archived projects are frozen"
          >
            <LockIcon />
          </span>
        ) : (
          <div className="flex items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
            <IconButton
              label={status === "ACTIVE" ? "Pause project" : "Activate project"}
              disabled={busy}
              onClick={() =>
                onChangeStatus(project.id, status === "ACTIVE" ? "PAUSED" : "ACTIVE")
              }
            >
              {status === "ACTIVE" ? <PauseIcon /> : <PlayIcon />}
            </IconButton>
            <IconButton label="Edit project" disabled={busy} onClick={() => onEdit(project)}>
              <EditIcon />
            </IconButton>
          </div>
        )}
      </div>
    </motion.li>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid size-8 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function PauseIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 5v14M15 5v14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function PlayIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 5.5v13l11-6.5-11-6.5Z" fill="currentColor" />
    </svg>
  );
}
function EditIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 20h4l10-10a2.1 2.1 0 0 0-3-3L5 17v3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M13.5 6.5l4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
