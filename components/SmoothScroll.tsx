"use client";

import { usePathname } from "next/navigation";
import { ReactLenis } from "lenis/react";

export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname.startsWith("/chat")) {
    return <>{children}</>;
  }

  return (
    <ReactLenis root options={{ lerp: 0.14, duration: 0.9, smoothWheel: true }}>
      {children}
    </ReactLenis>
  );
}
