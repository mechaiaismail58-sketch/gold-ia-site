"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type State = "idle" | "loading" | "completing";

export default function NavigationProgress() {
  const pathname = usePathname();
  const [state, setState] = useState<State>("idle");
  const prevPath = useRef(pathname);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Detect route change completion
  useEffect(() => {
    if (prevPath.current !== pathname) {
      prevPath.current = pathname;
      setState("completing");
      clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setState("idle"), 500);
    }
    return () => clearTimeout(hideTimer.current);
  }, [pathname]);

  // Detect navigation start by intercepting link clicks
  useEffect(() => {
    function onAnchorClick(e: MouseEvent) {
      const anchor = (e.target as Element).closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = anchor.getAttribute("href") ?? "";
      // Ignore external, hash, mailto, tel links
      if (
        href.startsWith("http") ||
        href.startsWith("//") ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      ) return;

      // Only trigger for different-path navigations
      const target = new URL(href, window.location.href);
      if (target.pathname !== window.location.pathname) {
        setState("loading");
        clearTimeout(hideTimer.current);
      }
    }

    document.addEventListener("click", onAnchorClick, true);
    return () => document.removeEventListener("click", onAnchorClick, true);
  }, []);

  if (state === "idle") return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[9999] h-[2px] w-full overflow-hidden"
    >
      <div
        className={[
          "h-full",
          "bg-gradient-to-r from-[rgba(109,40,217,0.9)] via-[rgba(139,92,246,1)] to-[rgba(167,139,250,0.9)]",
          "shadow-[0_0_10px_rgba(139,92,246,0.7)]",
          state === "loading"
            ? "nav-progress-bar"
            : "w-full transition-all duration-300 ease-out",
          state === "completing" ? "opacity-0" : "opacity-100",
        ].join(" ")}
        style={state === "completing" ? { width: "100%" } : undefined}
      />
    </div>
  );
}
