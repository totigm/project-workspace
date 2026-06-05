"use client";

import { motion } from "framer-motion";
import { FormEvent, useState } from "react";
import { Select, type SelectOption } from "@/app/select";

export type CreateResult = "ok" | "limit" | "error";

type CreateProjectFormProps = {
  isFree: boolean;
  used: number;
  freeLimit: number;
  onCreate: (name: string, status: string) => Promise<CreateResult>;
};

const STATUS_OPTIONS: SelectOption[] = [
  { value: "ACTIVE", label: "Active", dot: "var(--active)" },
  { value: "PAUSED", label: "Paused", dot: "var(--paused)" },
  { value: "ARCHIVED", label: "Archived", dot: "var(--archived)" }
];

export function CreateProjectForm({ isFree, used, freeLimit, onCreate }: CreateProjectFormProps) {
  const [name, setName] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const atLimit = isFree && used >= freeLimit;
  const usagePct = freeLimit > 0 ? Math.min(100, Math.round((used / freeLimit) * 100)) : 0;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give your project a name to continue.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    const result = await onCreate(trimmed, status);
    setIsSubmitting(false);

    if (result === "ok") {
      setName("");
      setStatus("ACTIVE");
    }
    // "limit" surfaces the upgrade modal upstream; "error" is toasted upstream.
  }

  return (
    <form onSubmit={onSubmit} className="panel p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="grid size-7 place-items-center rounded-lg"
          style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
        <div>
          <h2 className="text-[0.95rem] font-bold tracking-tight text-text">New project</h2>
          <p className="text-[0.8rem] text-muted">Spin one up — it shows up instantly below.</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="project-name" className="mb-1.5 block text-[0.72rem] font-bold uppercase tracking-wide text-subtle">
            Name
          </label>
          <input
            id="project-name"
            name="name"
            type="text"
            value={name}
            maxLength={80}
            placeholder="Q3 launch"
            aria-invalid={Boolean(error)}
            onChange={(event) => {
              setName(event.target.value);
              if (error) setError(null);
            }}
            className="h-11 w-full rounded-[var(--radius-md)] border border-border bg-surface-2 px-3.5 text-text placeholder:text-subtle transition-[border-color,box-shadow] focus:border-accent-border focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>

        <div className="sm:w-44">
          <label id="project-status-label" className="mb-1.5 block text-[0.72rem] font-bold uppercase tracking-wide text-subtle">
            Status
          </label>
          <Select
            id="project-status"
            ariaLabel="Project status"
            value={status}
            options={STATUS_OPTIONS}
            onChange={setStatus}
          />
        </div>

        <motion.button
          type="submit"
          disabled={isSubmitting}
          whileTap={{ scale: 0.97 }}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] px-5 font-semibold text-[var(--accent-contrast)] shadow-[var(--shadow-glow)] transition-[filter,opacity] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))" }}
        >
          {isSubmitting ? (
            <>
              <Spinner /> Creating…
            </>
          ) : (
            "Create project"
          )}
        </motion.button>
      </div>

      {error ? (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 text-[0.82rem] font-medium"
          style={{ color: "var(--danger)" }}
          role="alert"
        >
          {error}
        </motion.p>
      ) : null}

      {isFree ? (
        <div className="mt-4 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
            <motion.span
              className="block h-full rounded-full"
              style={{
                background: atLimit
                  ? "linear-gradient(90deg, var(--danger), var(--paused))"
                  : "linear-gradient(90deg, var(--accent), var(--accent-2))"
              }}
              initial={false}
              animate={{ width: `${usagePct}%` }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <span className="shrink-0 text-[0.78rem] font-semibold text-muted">
            <span className="tabular text-text">{used}</span> / {freeLimit} on Free
          </span>
        </div>
      ) : null}
    </form>
  );
}

function Spinner() {
  return (
    <svg className="motion-safe:animate-spin" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
