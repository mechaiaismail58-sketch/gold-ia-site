import type { ReactNode } from "react";

type GlassCardVariant = "default" | "purple-border" | "gold-accent";

interface GlassCardProps {
  variant?: GlassCardVariant;
  className?: string;
  children: ReactNode;
}

const BASE = "bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl rounded-2xl";

/**
 * Shared glass panel. variant="purple-border" draws an animated gradient
 * border via the padding-box / mask-composite trick (see .chat-border-glow
 * in globals.css). variant="gold-accent" adds a solid gold left border.
 */
export default function GlassCard({ variant = "default", className = "", children }: GlassCardProps) {
  if (variant === "purple-border") {
    return (
      <div className={`relative rounded-2xl chat-border-glow ${className}`}>
        <div className={`${BASE} relative`}>{children}</div>
      </div>
    );
  }

  if (variant === "gold-accent") {
    return (
      <div className={`${BASE} border-l-2 border-l-[#D4A843] ${className}`}>
        {children}
      </div>
    );
  }

  return <div className={`${BASE} ${className}`}>{children}</div>;
}
