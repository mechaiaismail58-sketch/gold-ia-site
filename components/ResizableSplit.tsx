"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
}

export default function ResizableSplit({
  left, right,
  defaultWidth = 420,
  minWidth = 280,
  maxWidth = 900,
}: Props) {
  const [leftWidth, setLeftWidth] = useState(defaultWidth);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDragging) return;
    function onMouseMove(e: MouseEvent) {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const w = Math.min(maxWidth, Math.max(minWidth, e.clientX - rect.left));
      setLeftWidth(w);
    }
    function onMouseUp() { setIsDragging(false); }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDragging, minWidth, maxWidth]);

  const snapBtn: React.CSSProperties = {
    width: 22, height: 22,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "none", border: "0.5px solid rgba(201,162,39,0.2)",
    borderRadius: 4, cursor: "pointer", color: "rgba(201,162,39,0.5)",
    fontSize: 11, fontFamily: "monospace",
    transition: "border-color 0.15s, color 0.15s",
    flexShrink: 0,
  };

  return (
    <div
      ref={containerRef}
      style={{ display: "flex", height: "100vh", overflow: "hidden", width: "100%", userSelect: isDragging ? "none" : undefined }}
    >
      {/* Left panel */}
      <div style={{ width: leftWidth, minWidth: leftWidth, maxWidth: leftWidth, height: "100vh", overflowY: "auto", overflowX: "hidden", flexShrink: 0 }}>
        {left}
      </div>

      {/* Drag handle */}
      <div
        style={{
          width: 20, flexShrink: 0, height: "100vh",
          display: "flex", flexDirection: "column", alignItems: "center",
          background: isDragging ? "rgba(201,162,39,0.04)" : "transparent",
          borderLeft: "0.5px solid rgba(201,162,39,0.15)",
          borderRight: "0.5px solid rgba(201,162,39,0.15)",
          cursor: "col-resize", transition: "background 0.15s",
        }}
        onMouseDown={(e) => { e.preventDefault(); setIsDragging(true); }}
      >
        {/* Snap buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 14 }}>
          <button
            style={snapBtn}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setLeftWidth(280)}
            title="Collapse (280px)"
          >‹</button>
          <button
            style={snapBtn}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setLeftWidth(420)}
            title="Reset (420px)"
          >=</button>
          <button
            style={snapBtn}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setLeftWidth(700)}
            title="Expand (700px)"
          >›</button>
        </div>

        {/* Drag dots */}
        <div style={{ display: "flex", flexDirection: "column", gap: 3, margin: "auto 0" }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(201,162,39,0.2)" }} />
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, height: "100vh", overflowY: "auto", minWidth: 0 }}>
        {right}
      </div>
    </div>
  );
}
