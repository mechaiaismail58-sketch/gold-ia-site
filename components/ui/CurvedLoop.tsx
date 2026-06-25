"use client";

import { useEffect, useId, useRef, useState } from "react";
import "./CurvedLoop.css";

interface CurvedLoopProps {
  text: string;
  speed?: number;
  curveAmount?: number;
  direction?: "left" | "right";
  className?: string;
}

export default function CurvedLoop({
  text,
  speed = 3,
  curveAmount = 400,
  direction = "left",
  className = "",
}: CurvedLoopProps) {
  const id = useId();
  const pathId = `curved-path-${id.replace(/:/g, "")}`;
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(1200);

  useEffect(() => {
    function measure() {
      if (svgRef.current?.parentElement) {
        setWidth(svgRef.current.parentElement.clientWidth);
      }
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const midX = width / 2;
  const midY = curveAmount;
  const viewBoxHeight = curveAmount + 60;

  const d =
    direction === "left"
      ? `M 0 ${viewBoxHeight - 30} Q ${midX} ${viewBoxHeight - midY - 30} ${width} ${viewBoxHeight - 30}`
      : `M ${width} ${viewBoxHeight - 30} Q ${midX} ${viewBoxHeight - midY - 30} 0 ${viewBoxHeight - 30}`;

  const separator = "    ";
  const repeatedText = Array(12).fill(text).join(separator);

  const dur = `${Math.max(5, 60 / speed)}s`;

  return (
    <div className={`curved-loop-wrapper ${className}`}>
      <svg
        ref={svgRef}
        className="curved-loop-svg"
        viewBox={`0 0 ${width} ${viewBoxHeight}`}
        preserveAspectRatio="none"
      >
        <defs>
          <path id={pathId} d={d} fill="none" />
        </defs>
        <text>
          <textPath href={`#${pathId}`} startOffset="0%">
            <animate
              attributeName="startOffset"
              from={direction === "left" ? "0%" : "0%"}
              to={direction === "left" ? "-200%" : "200%"}
              dur={dur}
              repeatCount="indefinite"
            />
            {repeatedText}
          </textPath>
        </text>
      </svg>
    </div>
  );
}
