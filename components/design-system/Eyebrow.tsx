import type { ReactNode } from "react";

interface EyebrowProps {
  children: ReactNode;
  color?: "gold" | "purple";
  className?: string;
}

const COLOR_MAP: Record<NonNullable<EyebrowProps["color"]>, string> = {
  gold: "#D4A843",
  purple: "#7B4FD4",
};

/** Small uppercase tracked label used above headings. */
export default function Eyebrow({ children, color = "gold", className = "" }: EyebrowProps) {
  return (
    <p
      className={`text-xs uppercase tracking-[0.3em] ${className}`}
      style={{ color: COLOR_MAP[color] }}
    >
      {children}
    </p>
  );
}
