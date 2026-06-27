"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  direction?: "up" | "left" | "right";
  delay?: number;
  duration?: number;
  className?: string;
};

const offsets = {
  up:    { x: 0, y: 40 },
  left:  { x: -40, y: 0 },
  right: { x: 40, y: 0 },
} as const;

export default function FadeInView({
  children,
  direction = "up",
  delay = 0,
  duration = 0.6,
  className,
}: Props) {
  const { x, y } = offsets[direction];

  return (
    <motion.div
      initial={{ opacity: 0, x, y }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
