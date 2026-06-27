import type { ReactNode } from "react";

interface NavShellProps {
  /** "floating" = rounded glass pill (public pages). "bar" = full-width flush bar (chat shell). */
  variant?: "floating" | "bar";
  className?: string;
  children: ReactNode;
}

/** Shared glass shell — same background, blur, border treatment for public and private navbars. */
export function NavShell({ variant = "floating", className = "", children }: NavShellProps) {
  const variantClass =
    variant === "floating"
      ? "border border-white/10 rounded-2xl shadow-[0_12px_50px_rgba(0,0,0,0.28)]"
      : "border-b border-white/10";

  return (
    <div
      className={`card px-5 py-4 relative z-40 ${variantClass} ${className}`}
      // .card sets border-radius via a plain CSS rule that wins over Tailwind's
      // rounded-* utilities in source order — force it off for the flush bar variant.
      style={variant === "bar" ? { borderRadius: 0 } : undefined}
    >
      {children}
    </div>
  );
}
