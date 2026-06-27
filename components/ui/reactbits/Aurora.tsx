"use client";

import { CSSProperties } from "react";

interface AuroraProps {
  colorStops?: string[];
  amplitude?: number;
  speed?: number;
  className?: string;
}

export default function Aurora({
  colorStops = ["#7C3AED", "#D4A843", "#7C3AED"],
  amplitude = 1.0,
  speed = 0.5,
  className = "",
}: AuroraProps) {
  const size = 350 + amplitude * 150;
  const blur = 80 + amplitude * 30;
  const baseOpacity = 0.45 + amplitude * 0.1;

  const orbs: { left: string; top: string; dx: number; dy: number }[] = [
    { left: "15%", top: "20%", dx: 60, dy: -40 },
    { left: "55%", top: "55%", dx: -50, dy: 30 },
    { left: "75%", top: "15%", dx: 30, dy: 50 },
    { left: "35%", top: "70%", dx: -40, dy: -60 },
  ];

  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      style={{ zIndex: 0 }}
      aria-hidden
    >
      {colorStops.map((color, ci) =>
        orbs.map((orb, oi) => {
          const i = ci * orbs.length + oi;
          const dur = (16 + i * 3) / speed;
          const orbSize = size + (i % 3) * 40;

          return (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: `${orbSize}px`,
                height: `${orbSize}px`,
                left: orb.left,
                top: orb.top,
                transform: "translate(-50%, -50%)",
                background: `radial-gradient(circle, ${color}99 0%, ${color}33 40%, transparent 70%)`,
                filter: `blur(${blur}px)`,
                opacity: baseOpacity - ci * 0.05,
                animation: `aurora-rb-${i % 6} ${dur}s ease-in-out infinite alternate`,
                willChange: "transform",
              }}
            />
          );
        })
      )}

      <style jsx>{`
        @keyframes aurora-rb-0 {
          from { transform: translate(-50%, -50%) translate(0, 0); }
          to { transform: translate(-50%, -50%) translate(${60 * amplitude}px, ${-40 * amplitude}px); }
        }
        @keyframes aurora-rb-1 {
          from { transform: translate(-50%, -50%) translate(0, 0); }
          to { transform: translate(-50%, -50%) translate(${-50 * amplitude}px, ${30 * amplitude}px); }
        }
        @keyframes aurora-rb-2 {
          from { transform: translate(-50%, -50%) translate(0, 0); }
          to { transform: translate(-50%, -50%) translate(${40 * amplitude}px, ${50 * amplitude}px); }
        }
        @keyframes aurora-rb-3 {
          from { transform: translate(-50%, -50%) translate(0, 0); }
          to { transform: translate(-50%, -50%) translate(${-30 * amplitude}px, ${-60 * amplitude}px); }
        }
        @keyframes aurora-rb-4 {
          from { transform: translate(-50%, -50%) translate(0, 0); }
          to { transform: translate(-50%, -50%) translate(${50 * amplitude}px, ${-30 * amplitude}px); }
        }
        @keyframes aurora-rb-5 {
          from { transform: translate(-50%, -50%) translate(0, 0); }
          to { transform: translate(-50%, -50%) translate(${-40 * amplitude}px, ${40 * amplitude}px); }
        }
        @media (prefers-reduced-motion: reduce) {
          div { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
