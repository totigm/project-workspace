type StatusKey = "ACTIVE" | "PAUSED" | "ARCHIVED";

const STATUS: Record<StatusKey, { label: string; color: string; soft: string }> = {
  ACTIVE: { label: "Active", color: "var(--active)", soft: "var(--active-soft)" },
  PAUSED: { label: "Paused", color: "var(--paused)", soft: "var(--paused-soft)" },
  ARCHIVED: { label: "Archived", color: "var(--archived)", soft: "var(--archived-soft)" }
};

export function statusMeta(status: string) {
  return STATUS[(status.toUpperCase() as StatusKey)] ?? STATUS.ACTIVE;
}

export function StatusBadge({ status }: { status: string }) {
  const key = status.toUpperCase() as StatusKey;
  const meta = STATUS[key] ?? STATUS.ACTIVE;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-wide"
      style={{ background: meta.soft, color: meta.color }}
    >
      <span className="relative grid size-1.5 place-items-center">
        <span
          className="size-1.5 rounded-full"
          style={{ background: meta.color, boxShadow: `0 0 8px ${meta.color}` }}
        />
        {key === "ACTIVE" ? (
          <span
            className="absolute inline-flex size-1.5 rounded-full opacity-70 motion-safe:animate-ping"
            style={{ background: meta.color }}
          />
        ) : null}
      </span>
      {meta.label}
    </span>
  );
}
