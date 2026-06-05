"use client";

import { animate } from "framer-motion";
import { useEffect, useRef, useState } from "react";

// Animates from the previous value to the next whenever `value` changes.
export function CountUp({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce || prev.current === value) {
      setDisplay(value);
      prev.current = value;
      return;
    }

    const controls = animate(prev.current, value, {
      duration: 0.7,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(Math.round(v))
    });
    prev.current = value;
    return () => controls.stop();
  }, [value]);

  return <span className={className}>{display}</span>;
}
