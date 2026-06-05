"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";

export type SelectOption = {
  value: string;
  label: string;
  /** Optional leading dot color (CSS color or var) — e.g. status indicators. */
  dot?: string;
};

type SelectProps = {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  id?: string;
  ariaLabel?: string;
  className?: string;
};

// Accessible custom listbox: keyboard nav, type-ahead, click-outside, themed to
// match the app's inputs (no native <select> chrome).
export function Select({ value, options, onChange, id, ariaLabel, className }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(0, options.findIndex((o) => o.value === value))
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ buffer: "", timer: 0 });
  const reactId = useId();
  const listboxId = `${id ?? reactId}-listbox`;

  const selected = options.find((o) => o.value === value) ?? options[0];
  const selectedIndex = options.findIndex((o) => o.value === value);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // When opening, point the active option at the current selection.
  useEffect(() => {
    if (open) setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [open, selectedIndex]);

  // Keep the active option scrolled into view.
  useEffect(() => {
    if (!open) return;
    const node = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    node?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  function commit(index: number) {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) {
          setOpen(true);
        } else {
          setActiveIndex((i) => Math.min(options.length - 1, i + 1));
        }
        break;
      case "ArrowUp":
        event.preventDefault();
        if (!open) setOpen(true);
        else setActiveIndex((i) => Math.max(0, i - 1));
        break;
      case "Home":
        if (open) {
          event.preventDefault();
          setActiveIndex(0);
        }
        break;
      case "End":
        if (open) {
          event.preventDefault();
          setActiveIndex(options.length - 1);
        }
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (open) commit(activeIndex);
        else setOpen(true);
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          setOpen(false);
        }
        break;
      case "Tab":
        setOpen(false);
        break;
      default:
        // Type-ahead: jump to the first option starting with the typed string.
        if (event.key.length === 1 && /\S/.test(event.key)) {
          const ta = typeahead.current;
          window.clearTimeout(ta.timer);
          ta.buffer += event.key.toLowerCase();
          ta.timer = window.setTimeout(() => (ta.buffer = ""), 600);
          const match = options.findIndex((o) => o.label.toLowerCase().startsWith(ta.buffer));
          if (match >= 0) {
            setActiveIndex(match);
            if (!open) commit(match);
          }
        }
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`}>
      <button
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className="flex h-11 w-full items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface-2 px-3.5 text-left text-text transition-[border-color,box-shadow] focus:border-accent-border focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
      >
        {selected?.dot ? (
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full"
            style={{ background: selected.dot, boxShadow: `0 0 8px ${selected.dot}` }}
          />
        ) : null}
        <span className="flex-1 truncate">{selected?.label}</span>
        <motion.svg
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0 text-subtle"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </motion.svg>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-activedescendant={`${listboxId}-opt-${activeIndex}`}
            tabIndex={-1}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 500, damping: 34 }}
            className="panel absolute z-50 mt-2 max-h-64 w-full overflow-auto p-1.5"
            style={{ boxShadow: "var(--shadow-lg)" }}
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
              const isActive = index === activeIndex;
              return (
                <li
                  key={option.value}
                  id={`${listboxId}-opt-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => commit(index)}
                  className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-sm transition-colors"
                  style={{
                    background: isActive ? "var(--surface-3)" : "transparent",
                    color: "var(--text)"
                  }}
                >
                  {option.dot ? (
                    <span
                      aria-hidden="true"
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: option.dot, boxShadow: `0 0 8px ${option.dot}` }}
                    />
                  ) : null}
                  <span className="flex-1 truncate font-medium">{option.label}</span>
                  {isSelected ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" style={{ color: "var(--accent-ink)" }}>
                      <path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : null}
                </li>
              );
            })}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
