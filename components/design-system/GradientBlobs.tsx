"use client";

import { useEffect, useRef } from "react";

/**
 * Shared animated background — purple/gold radial glows with scroll
 * parallax. Soft falloff baked into the gradients themselves: no CSS
 * blur() filter (3 huge filtered layers re-composited every frame).
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
        className="absolute -top-40 right-[-260px] h-[720px] w-[720px] rounded-full will-change-transform"
        style={{ background: "radial-gradient(circle, rgba(124,58,237,0.22) 0%, rgba(124,58,237,0.10) 35%, transparent 68%)" }}
      />
      <div
        ref={purpleBlobBRef}
        className="absolute top-[20px] left-[-280px] h-[620px] w-[620px] rounded-full will-change-transform"
        style={{ background: "radial-gradient(circle, rgba(109,40,217,0.17) 0%, rgba(109,40,217,0.08) 35%, transparent 68%)" }}
      />
      <div
        className="absolute bottom-[-320px] left-[16%] h-[720px] w-[720px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(212,168,67,0.08) 0%, rgba(212,168,67,0.035) 35%, transparent 68%)" }}
      />
    </div>
  );
}
