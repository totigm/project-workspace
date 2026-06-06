"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type DatePickerProps = {
  value: string; // "YYYY-MM-DD" or ""
  onChange: (value: string) => void;
  id?: string;
  ariaLabel?: string;
  placeholder?: string;
};

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const DISPLAY_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric"
});

const pad = (n: number) => String(n).padStart(2, "0");
const toISO = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

function parseISO(value: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) };
}

function formatDisplay(value: string): string | null {
  const parsed = parseISO(value);
  if (!parsed) return null;
  return DISPLAY_FMT.format(new Date(parsed.y, parsed.m, parsed.d));
}

type Position = { left: number; width: number; top?: number; bottom?: number };

// Custom calendar date picker matching the app's inputs. The calendar popover is
// portaled to <body> so it isn't clipped by a modal's `overflow: hidden`.
export function DatePicker({ value, onChange, id, ariaLabel, placeholder = "Select a date" }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const today = useMemo(() => {
    const now = new Date();
    return { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
  }, []);
  const selected = parseISO(value);

  // The month currently shown; follows the selected value, else today.
  const [view, setView] = useState(() => ({
    y: selected?.y ?? today.y,
    m: selected?.m ?? today.m
  }));

  useEffect(() => {
    if (open) {
      setView({ y: selected?.y ?? today.y, m: selected?.m ?? today.m });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const updatePosition = useCallback(() => {
    const el = buttonRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 8;
    const estHeight = 360;
    const spaceBelow = window.innerHeight - r.bottom;
    const openUp = spaceBelow < estHeight && r.top > spaceBelow;
    setPosition({
      left: r.left,
      width: r.width,
      top: openUp ? undefined : r.bottom + gap,
      bottom: openUp ? window.innerHeight - r.top + gap : undefined
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const grid = useMemo(() => {
    const firstWeekday = new Date(view.y, view.m, 1).getDay();
    const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [view]);

  function shiftMonth(delta: number) {
    setView((v) => {
      const next = new Date(v.y, v.m + delta, 1);
      return { y: next.getFullYear(), m: next.getMonth() };
    });
  }

  function pick(day: number) {
    onChange(toISO(view.y, view.m, day));
    setOpen(false);
  }

  const display = formatDisplay(value);

  const popover =
    open && position && typeof document !== "undefined"
      ? createPortal(
          <AnimatePresence>
            <motion.div
              ref={popoverRef}
              role="dialog"
              aria-label="Choose date"
              initial={{ opacity: 0, y: position.bottom ? 6 : -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: position.bottom ? 6 : -6, scale: 0.98, transition: { duration: 0.12 } }}
              transition={{ type: "spring", stiffness: 500, damping: 34 }}
              className="panel fixed z-[1100] w-[18rem] p-3"
              style={{
                left: position.left,
                top: position.top,
                bottom: position.bottom,
                boxShadow: "var(--shadow-lg)"
              }}
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-bold text-text">
                  {MONTHS[view.m]} {view.y}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Previous month"
                    onClick={() => shiftMonth(-1)}
                    className="grid size-7 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-text"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m14 6-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    aria-label="Next month"
                    onClick={() => shiftMonth(1)}
                    className="grid size-7 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-text"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m10 6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1">
                {WEEKDAYS.map((wd) => (
                  <div
                    key={wd}
                    className="grid h-7 place-items-center text-[0.66rem] font-bold uppercase tracking-wide text-subtle"
                  >
                    {wd}
                  </div>
                ))}
                {grid.map((day, i) => {
                  if (day === null) return <div key={`b-${i}`} className="size-9" />;
                  const isSelected =
                    selected?.y === view.y && selected?.m === view.m && selected?.d === day;
                  const isToday = today.y === view.y && today.m === view.m && today.d === day;
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => pick(day)}
                      aria-pressed={isSelected}
                      className="grid size-9 place-items-center rounded-[var(--radius-sm)] text-sm font-medium transition-colors"
                      style={
                        isSelected
                          ? {
                              background: "linear-gradient(135deg, var(--accent), var(--accent-2))",
                              color: "var(--accent-contrast)"
                            }
                          : isToday
                            ? { background: "var(--surface-2)", color: "var(--accent-ink)" }
                            : { color: "var(--text)" }
                      }
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  className="rounded-md px-2 py-1 text-sm font-semibold text-muted transition-colors hover:text-text"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onChange(toISO(today.y, today.m, today.d));
                    setOpen(false);
                  }}
                  className="rounded-md px-2 py-1 text-sm font-semibold text-accent-ink transition-colors hover:brightness-110"
                >
                  Today
                </button>
              </div>
            </motion.div>
          </AnimatePresence>,
          document.body
        )
      : null;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-full items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface-2 px-3.5 text-left transition-[border-color,box-shadow] focus:border-accent-border focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
      >
        <svg className="shrink-0 text-subtle" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3.5" y="5" width="17" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <span className={`flex-1 truncate ${display ? "text-text" : "text-subtle"}`}>
          {display ?? placeholder}
        </span>
      </button>

      {popover}
    </div>
  );
}
