import type { ReactNode } from "react";

interface NavShellProps {
  /** "floating" = transparent header (public pages). "bar" = full-width flush bar (chat shell). */
  variant?: "floating" | "bar";
  className?: string;
  children: ReactNode;
}

export function NavShell({ variant = "floating", className = "", children }: NavShellProps) {
  return (
    <div
      className={`px-5 py-4 relative z-40 ${className}`}
      style={variant === "bar" ? { borderBottom: "1px solid rgba(255,255,255,0.03)" } : undefined}
    >
      {children}
    </div>
  );
}
