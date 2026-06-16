"use client";
import { motion } from "framer-motion";
import { ReactNode } from "react";

// Simple fade-in-up on scroll (opacity 0→1, translateY 20px→0). No scale.
export default function ScrollZoom({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
