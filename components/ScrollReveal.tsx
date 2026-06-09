"use client";

import { useEffect, useRef, useState } from "react";

type Variant = "zoom" | "rise" | "slide-left" | "slide-right";

interface ScrollRevealProps {
  children: React.ReactNode;
  variant?: Variant;
  delay?: number;
  className?: string;
}

const SPRING = "cubic-bezier(0.16,1,0.3,1)";

function buildStyle(visible: boolean, variant: Variant, delay: number): React.CSSProperties {
  const t = (ms: number) => `${ms}ms ${SPRING} ${delay}ms`;

  switch (variant) {
    case "zoom":
      return {
        opacity: visible ? 1 : 0,
        transform: visible ? "scale(1)" : "scale(0.85)",
        filter: visible ? "blur(0px)" : "blur(8px)",
        transition: `opacity 900ms ${SPRING} ${delay}ms, transform 900ms ${SPRING} ${delay}ms, filter 900ms ${SPRING} ${delay}ms`,
        willChange: "opacity, transform, filter",
      };
    case "rise":
      return {
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0) scale(1)" : "translateY(80px) scale(0.97)",
        transition: `opacity 800ms ${SPRING} ${delay}ms, transform 800ms ${SPRING} ${delay}ms`,
        willChange: "opacity, transform",
      };
    case "slide-left":
      return {
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0) scale(1)" : "translateX(100px) scale(0.95)",
        transition: `opacity 800ms ${SPRING} ${delay}ms, transform 800ms ${SPRING} ${delay}ms`,
        willChange: "opacity, transform",
      };
    case "slide-right":
      return {
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0) scale(1)" : "translateX(-100px) scale(0.95)",
        transition: `opacity 800ms ${SPRING} ${delay}ms, transform 800ms ${SPRING} ${delay}ms`,
        willChange: "opacity, transform",
      };
  }
}

export default function ScrollReveal({
  children,
  variant = "zoom",
  delay = 0,
  className = "",
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      setReducedMotion(true);
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { setVisible(true); obs.unobserve(el); }
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={reducedMotion ? {} : buildStyle(visible, variant, delay)}
      className={className}
    >
      {children}
    </div>
  );
}
