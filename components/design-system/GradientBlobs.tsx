"use client";

import { useEffect, useRef } from "react";

/**
 * Shared animated background — purple/gold radial blobs with scroll
 * parallax. Mounted once in the root layout so every route (including
 * /chat/*) gets the identical background. Extracted verbatim from the
 * landing page (components/WaitlistLanding.tsx).
 */
export default function GradientBlobs() {
  const purpleBlobARef = useRef<HTMLDivElement | null>(null);
  const purpleBlobBRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    function applyParallax() {
      const y = window.scrollY;
      if (purpleBlobARef.current) purpleBlobARef.current.style.transform = `translate3d(0, ${y * 0.12}px, 0)`;
      if (purpleBlobBRef.current) purpleBlobBRef.current.style.transform = `translate3d(0, ${y * 0.07}px, 0)`;
      frame = 0;
    }
    function onScroll() {
      if (frame) return;
      frame = requestAnimationFrame(applyParallax);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 -z-30">
      <div
        ref={purpleBlobARef}
        className="absolute -top-28 right-[-180px] h-[560px] w-[560px] rounded-full blur-[120px]"
        style={{ background: "radial-gradient(circle, rgba(124,58,237,0.26) 0%, transparent 70%)" }}
      />
      <div
        ref={purpleBlobBRef}
        className="absolute top-[80px] left-[-200px] h-[480px] w-[480px] rounded-full blur-[120px]"
        style={{ background: "radial-gradient(circle, rgba(109,40,217,0.20) 0%, transparent 70%)" }}
      />
      <div
        className="absolute bottom-[-240px] left-[18%] h-[560px] w-[560px] rounded-full blur-[130px]"
        style={{ background: "radial-gradient(circle, rgba(212,168,67,0.09) 0%, transparent 70%)" }}
      />
    </div>
  );
}
