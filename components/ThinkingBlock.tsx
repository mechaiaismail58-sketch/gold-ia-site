"use client";

import { useEffect, useRef, useState } from "react";

interface ThinkingBlockProps {
  lines: string[];
  isComplete: boolean;
}

export default function ThinkingBlock({ lines, isComplete }: ThinkingBlockProps) {
  const [visible, setVisible] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Safety timeout: if thinking never completes in 30s, fade it out anyway
  useEffect(() => {
    timeoutRef.current = setTimeout(() => setVisible(false), 30_000);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  // When complete, start fade-out
  useEffect(() => {
    if (!isComplete) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const t = setTimeout(() => setVisible(false), 500);
    return () => clearTimeout(t);
  }, [isComplete]);

  if (!visible) return null;

  return (
    <div
      style={{
        background: "rgba(212,175,55,0.03)",
        borderLeft: "2px solid rgba(212,175,55,0.2)",
        borderRadius: "0 8px 8px 0",
        padding: "10px 14px",
        marginBottom: "12px",
        transition: "opacity 500ms ease-out, max-height 500ms ease-out",
        opacity: isComplete ? 0 : 1,
        maxHeight: isComplete ? "0" : "300px",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
        <span
          className="thinking-pulse"
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: "#D4AF37",
            flexShrink: 0,
            animation: isComplete ? "none" : undefined,
            opacity: isComplete ? 0.3 : undefined,
          }}
        />
        <span style={{
          fontSize: "9px",
          textTransform: "uppercase",
          letterSpacing: "0.2em",
          color: "rgba(212,175,55,0.5)",
          fontFamily: "var(--font-geist-mono, monospace)",
        }}>
          THINKING
        </span>
      </div>

      {/* Lines */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
        {lines.map((line, i) => {
          const dashMatch = line.match(/^(—\s*)(.*)/);
          const dash = dashMatch ? dashMatch[1] : "";
          const rest = dashMatch ? dashMatch[2] : line;
          return (
            <div
              key={i}
              className="thinking-line"
              style={{
                fontSize: "12px",
                color: "rgba(255,255,255,0.4)",
                fontFamily: "var(--font-geist-mono, monospace)",
                lineHeight: "1.6",
                animationDelay: `${i * 150}ms`,
              }}
            >
              {dash && <span style={{ color: "rgba(212,175,55,0.4)" }}>{dash}</span>}
              {rest}
            </div>
          );
        })}
      </div>
    </div>
  );
}
