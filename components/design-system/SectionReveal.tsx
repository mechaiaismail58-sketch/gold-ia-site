"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

interface SectionRevealProps {
  children: ReactNode;
  delay?: number;
  /** Vertical offset (px) the content rises from. Defaults to 40. */
  y?: number;
  /** Horizontal offset (px). Use for alternating left/right reveals. */
  x?: number;
  className?: string;
}

/**
 * The single entrance-animation primitive: scroll-triggered fade + rise
 * (or slide, via x), spring physics, plays once. Respects
 * prefers-reduced-motion by rendering content fully visible immediately.
 */
export default function SectionReveal({ children, delay = 0, y = 40, x = 0, className }: SectionRevealProps) {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y, x }}
      whileInView={{ opacity: 1, y: 0, x: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ type: "spring", stiffness: 60, damping: 16, delay: delay / 1000 }}
    >
      {children}
    </motion.div>
  );
}
