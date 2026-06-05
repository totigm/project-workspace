"use client";

import { AnimatePresence, motion } from "framer-motion";
import { type KeyboardEvent, useMemo, useRef, useState } from "react";
import { ProjectRow } from "@/app/project-row";
import type { ClientProject } from "@/app/workspace";

type Filter = "ALL" | "ACTIVE" | "PAUSED" | "ARCHIVED";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "PAUSED", label: "Paused" },
  { key: "ARCHIVED", label: "Archived" }
];

type ProjectsPanelProps = {
  projects: ClientProject[];
  busyIds: Set<string>;
  loading: boolean;
  onChangeStatus: (id: string, status: string) => void;
  onEdit: (project: ClientProject) => void;
};

export function ProjectsPanel({
  projects,
  busyIds,
  loading,
  onChangeStatus,
  onEdit
}: ProjectsPanelProps) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { ALL: projects.length, ACTIVE: 0, PAUSED: 0, ARCHIVED: 0 };
    for (const p of projects) {
      const k = p.status.toUpperCase() as Exclude<Filter, "ALL">;
      if (k in c) c[k] += 1;
    }
    return c;
  }, [projects]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      const matchesFilter = filter === "ALL" || p.status.toUpperCase() === filter;
      const matchesQuery = q === "" || p.name.toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });
  }, [projects, filter, query]);

  const hasAny = projects.length > 0;
  const isFiltered = filter !== "ALL" || query.trim() !== "";

  // Roving-tabindex keyboard support for the filter group: it's a single tab
  // stop, and arrow/Home/End move between filters, applying as they go.
  const filterRefs = useRef<(HTMLButtonElement | null)[]>([]);
  function onFilterKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      next = (index + 1) % FILTERS.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      next = (index - 1 + FILTERS.length) % FILTERS.length;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = FILTERS.length - 1;
    }
    if (next === null) return;
    event.preventDefault();
    setFilter(FILTERS[next].key);
    filterRefs.current[next]?.focus();
  }

  return (
    <section aria-label="Projects" className="panel overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div
          role="group"
          aria-label="Filter projects by status"
          className="flex items-center gap-1 overflow-x-auto rounded-full border border-border bg-surface-2/60 p-1"
        >
          {FILTERS.map((f, index) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                ref={(element) => {
                  filterRefs.current[index] = element;
                }}
                onClick={() => setFilter(f.key)}
                onKeyDown={(event) => onFilterKeyDown(event, index)}
                aria-pressed={active}
                tabIndex={active ? 0 : -1}
                className="relative isolate shrink-0 rounded-full px-3 py-1.5 text-[0.82rem] font-semibold transition-colors"
                style={{ color: active ? "var(--accent-contrast)" : "var(--text-muted)" }}
              >
                {active ? (
                  <motion.span
                    layoutId="filter-pill"
                    transition={{ type: "spring", stiffness: 460, damping: 36 }}
                    className="absolute inset-0 -z-10 rounded-full"
                    style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))" }}
                  />
                ) : null}
                {f.label}
                <span className="ml-1.5 tabular opacity-70">{counts[f.key]}</span>
              </button>
            );
          })}
        </div>

        <div className="relative sm:w-60">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle"
            width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
            <path d="m20 20-3.2-3.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search projects"
            aria-label="Search projects"
            className="h-10 w-full rounded-full border border-border bg-surface-2 pl-9 pr-3.5 text-sm text-text placeholder:text-subtle transition-colors focus:border-accent-border focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>
      </div>

      {/* Column header (desktop) */}
      {hasAny && !loading ? (
        <div className="hidden grid-cols-[1fr_8.5rem_auto] gap-4 px-5 pb-2 pt-3 text-[0.7rem] font-bold uppercase tracking-wider text-subtle sm:grid">
          <span>Project</span>
          <span>Created</span>
          <span className="text-right">Status</span>
        </div>
      ) : null}

      {/* Body */}
      {loading ? (
        <SkeletonList />
      ) : !hasAny ? (
        <EmptyState
          title="No projects yet"
          message="Create your first project above — it'll appear here instantly."
          variant="empty"
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title="No matches"
          message="No projects match your search and filters."
          variant="search"
          action={
            isFiltered ? (
              <button
                type="button"
                onClick={() => {
                  setFilter("ALL");
                  setQuery("");
                }}
                className="mt-4 rounded-[var(--radius-md)] border border-border bg-surface-2 px-4 py-2 text-sm font-semibold text-text transition-colors hover:border-border-strong"
              >
                Clear filters
              </button>
            ) : null
          }
        />
      ) : (
        <ul className="px-0 pb-1">
          <AnimatePresence initial={false} mode="popLayout">
            {visible.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                busy={busyIds.has(project.id)}
                onChangeStatus={onChangeStatus}
                onEdit={onEdit}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}

function SkeletonList() {
  return (
    <ul aria-hidden="true" className="p-2">
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex items-center justify-between gap-4 px-3 py-3.5">
          <div className="flex-1">
            <div className="skeleton h-3.5 w-1/3 rounded-full" />
            <div className="skeleton mt-2 h-2.5 w-20 rounded-full" />
          </div>
          <div className="skeleton h-5 w-16 rounded-full" />
        </li>
      ))}
    </ul>
  );
}

function EmptyState({
  title,
  message,
  variant,
  action
}: {
  title: string;
  message: string;
  variant: "empty" | "search";
  action?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center px-6 py-14 text-center"
    >
      <span
        aria-hidden="true"
        className="mb-4 grid size-14 place-items-center rounded-2xl"
        style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}
      >
        {variant === "empty" ? (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.2c.6 0 1.1.3 1.5.8l.9 1.2h7.4A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-9Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="M12 11v4M10 13h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.7" />
            <path d="m20 20-3.2-3.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        )}
      </span>
      <p className="text-base font-semibold text-text">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-muted">{message}</p>
      {action}
    </motion.div>
  );
}
