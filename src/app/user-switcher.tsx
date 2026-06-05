"use client";

import { motion } from "framer-motion";
import { useState } from "react";

type SwitchUser = { id: string; label: string };

export function UserSwitcher({
  users,
  activeId,
  onSelect
}: {
  users: SwitchUser[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  // Track the selection optimistically so the pill slides instantly on click,
  // before the server navigation resolves.
  const [selected, setSelected] = useState(activeId);

  function select(id: string) {
    if (id === selected) return;
    setSelected(id);
    onSelect(id);
  }

  return (
    <div
      role="tablist"
      aria-label="Switch current user"
      className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-1 p-1 shadow-sm"
    >
      {users.map((user) => {
        const isActive = selected === user.id;
        return (
          <button
            key={user.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => select(user.id)}
            className="relative isolate rounded-full px-4 py-1.5 text-sm font-semibold transition-colors"
            style={{ color: isActive ? "var(--accent-contrast)" : "var(--text-muted)" }}
          >
            {isActive ? (
              <motion.span
                layoutId="user-pill"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="absolute inset-0 -z-10 rounded-full"
                style={{
                  background: "linear-gradient(135deg, var(--accent), var(--accent-2))",
                  boxShadow: "var(--shadow-glow)"
                }}
              />
            ) : null}
            {user.label}
          </button>
        );
      })}
    </div>
  );
}
