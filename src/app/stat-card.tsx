import { CountUp } from "@/app/count-up";

export function StatCard({ count }: { count: number }) {
  return (
    <div className="panel relative flex items-center gap-4 overflow-hidden px-5 py-4">
      <span
        aria-hidden="true"
        className="grid size-11 place-items-center rounded-xl"
        style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.2c.6 0 1.1.3 1.5.8l.9 1.2h7.4A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-9Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <div className="leading-none">
        <CountUp value={count} className="tabular text-3xl font-extrabold tracking-tight text-text" />
        <p className="mt-1.5 text-sm font-medium text-muted">
          {count === 1 ? "project" : "projects"}
        </p>
      </div>
    </div>
  );
}

export function PlanPill({ plan }: { plan: string }) {
  const isPro = plan.toUpperCase() === "PRO";
  return (
    <div
      className="panel flex items-center gap-2.5 px-4 py-3"
      style={
        isPro
          ? { borderColor: "var(--accent-border)", boxShadow: "var(--shadow-glow)" }
          : undefined
      }
    >
      <span className="text-[0.7rem] font-bold uppercase tracking-wider text-subtle">Plan</span>
      <span className="flex items-center gap-1.5">
        {isPro ? (
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style={{ color: "var(--accent-ink)" }}>
            <path d="M13 2 4.5 13.2c-.4.5 0 1.3.6 1.3H11l-1 8 8.5-11.2c.4-.5 0-1.3-.6-1.3H12l1-8Z" fill="currentColor" />
          </svg>
        ) : null}
        <strong
          className="text-sm font-bold uppercase tracking-wide"
          style={{ color: isPro ? "var(--accent-ink)" : "var(--text)" }}
        >
          {plan.toLowerCase()}
        </strong>
      </span>
    </div>
  );
}
