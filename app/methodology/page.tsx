"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";

const SPRING = "cubic-bezier(0.16,1,0.3,1)";

/* ── Single IntersectionObserver hook ── */
function useReveal(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setVisible(true); return; }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.unobserve(el); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

/* ── Per-variant style helpers ── */
function riseStyle(visible: boolean, delay = 0): CSSProperties {
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0) scale(1)" : "translateY(80px) scale(0.97)",
    transition: `opacity 800ms ${SPRING} ${delay}ms, transform 800ms ${SPRING} ${delay}ms`,
    willChange: "opacity, transform",
  };
}

function zoomStyle(visible: boolean, delay = 0): CSSProperties {
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? "scale(1)" : "scale(0.85)",
    filter: visible ? "blur(0px)" : "blur(8px)",
    transition: `opacity 900ms ${SPRING} ${delay}ms, transform 900ms ${SPRING} ${delay}ms, filter 900ms ${SPRING} ${delay}ms`,
    willChange: "opacity, transform, filter",
  };
}

/* ── Data ── */
const FRAMEWORK = [
  {
    num: "01",
    label: "Market Structure",
    title: "Reading the structure before the move.",
    desc: "Higher timeframe bias. Key levels. Orderblocks. Fair Value Gaps. Every analysis starts with structure — we map the battlefield before we look for entries.",
    glowColor: "rgba(212,168,67,0.08)",
    glowPos: "top-0 right-0",
    numSide: "right",
  },
  {
    num: "02",
    label: "Macro Analysis",
    title: "Why gold moves. And where it stops.",
    desc: "DXY. Real yields. Fed policy. ETF flows. Intermarket correlations. Macro tells us WHY gold is moving. Structure tells us WHERE.",
    glowColor: "rgba(124,58,237,0.10)",
    glowPos: "bottom-0 left-0",
    numSide: "left",
  },
  {
    num: "03",
    label: "Risk Management",
    title: "Risk is math, not emotion.",
    desc: "Position sizing tied to structure. R-multiple tracking. Drawdown limits that don't bend. Risk is math, not emotion — and the AI enforces it on every response.",
    glowColor: "rgba(212,168,67,0.08)",
    glowPos: "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
    numSide: "right",
  },
  {
    num: "04",
    label: "Psychology & Discipline",
    title: "The AI that says wait.",
    desc: "Bias detection. Overtrading alerts. Consistency scoring. The AI says 'wait' more often than it says 'go' — and that's the point.",
    glowColor: "rgba(124,58,237,0.08)",
    glowPos: "top-0 left-0",
    numSide: "left",
  },
] as const;

const STATS = [
  { value: "22+", label: "Live Data Sources" },
  { value: "No Signals", label: "Just Clarity" },
  { value: "7", label: "Prop Firms Supported" },
];

/* ── Animated divider — grows from center ── */
function AnimatedDivider() {
  const { ref, visible } = useReveal(0.3);
  return (
    <div ref={ref} className="flex justify-center overflow-hidden py-px">
      <div
        style={{
          height: "1px",
          width: visible ? "288px" : "0px",
          opacity: visible ? 1 : 0,
          background: "linear-gradient(to right, transparent, rgba(255,255,255,0.10), transparent)",
          transition: `width 500ms ${SPRING} 0ms, opacity 400ms ease 0ms`,
        }}
      />
    </div>
  );
}

/* ── Framework section with cascade animations ── */
function FrameworkSection({ item, index }: { item: typeof FRAMEWORK[number]; index: number }) {
  const { ref, visible } = useReveal(0.10);

  const numStyle: CSSProperties = {
    opacity: visible ? 0.06 : 0,
    transform: visible ? "scale(1)" : "scale(0.5)",
    transition: `opacity 1200ms ${SPRING} 0ms, transform 1200ms ${SPRING} 0ms`,
    color: "#D4A843",
    fontSize: "clamp(100px, 18vw, 180px)",
    fontWeight: 700,
    lineHeight: 1,
  };

  const glowStyle: CSSProperties = {
    opacity: visible ? 1 : 0,
    transition: "opacity 1500ms ease 100ms",
    background: item.glowColor,
  };

  return (
    <section className="min-h-[80vh] flex items-center relative z-10 overflow-hidden py-20 md:py-0">
      {/* Glow — fades in with section */}
      <div
        className={`absolute ${item.glowPos} w-[480px] h-[480px] rounded-full blur-[150px] pointer-events-none`}
        style={glowStyle}
        aria-hidden
      />
      {/* Watermark number — scales in */}
      <div
        className={`absolute select-none pointer-events-none ${
          item.numSide === "right" ? "right-0 md:right-8" : "left-0 md:left-8"
        } top-1/2 -translate-y-1/2`}
        style={numStyle}
        aria-hidden
      >
        {item.num}
      </div>
      {/* Content — cascade via ref trigger */}
      <div
        ref={ref}
        className={`relative z-10 max-w-4xl mx-auto px-6 w-full ${
          index % 2 === 0 ? "md:pr-40" : "md:pl-40"
        }`}
      >
        <p className="text-xs uppercase tracking-[0.3em] mb-4" style={{ ...riseStyle(visible, 200), color: "#D4A843", display: "block" }}>
          {item.label}
        </p>
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 leading-tight" style={riseStyle(visible, 400)}>
          {item.title}
        </h2>
        <p className="text-lg leading-relaxed max-w-2xl" style={{ ...riseStyle(visible, 600), color: "#A1A1AA" }}>
          {item.desc}
        </p>
      </div>
    </section>
  );
}

/* ── Animated stat (zoom) with animated divider ── */
function StatItem({ value, label, delay, showDivider }: { value: string; label: string; delay: number; showDivider: boolean }) {
  const { ref, visible } = useReveal(0.2);
  return (
    <div className="relative flex flex-col items-center text-center">
      {showDivider && (
        <div
          className="hidden sm:block absolute left-0 top-1/2 -translate-y-1/2 w-px bg-white/10"
          style={{
            height: visible ? "64px" : "0px",
            transition: `height 400ms ${SPRING} ${delay + 400}ms`,
          }}
        />
      )}
      <div ref={ref} style={zoomStyle(visible, delay)}>
        <p className="text-5xl font-bold" style={{ color: "#D4A843" }}>{value}</p>
        <p className="text-sm mt-2" style={{ color: "#71717A" }}>{label}</p>
      </div>
    </div>
  );
}

/* ── Main ── */
export default function MethodologyPage() {
  const [loaded, setLoaded] = useState(false);
  const ctaReveal = useReveal(0.2);

  useEffect(() => {
    const id = requestAnimationFrame(() => setLoaded(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const heroTitleStyle: CSSProperties = {
    opacity: loaded ? 1 : 0,
    transform: loaded ? "scale(1)" : "scale(0.7)",
    filter: loaded ? "blur(0px)" : "blur(12px)",
    transition: `opacity 1200ms ${SPRING} 0ms, transform 1200ms ${SPRING} 0ms, filter 1200ms ${SPRING} 0ms`,
  };

  const goldLineStyle: CSSProperties = {
    width: loaded ? "64px" : "0px",
    opacity: loaded ? 1 : 0,
    height: "2px",
    background: "linear-gradient(to right, transparent, #D4A843, transparent)",
    transition: `width 300ms ${SPRING} 800ms, opacity 300ms ease 800ms`,
    margin: "2rem auto 0",
  };

  const subtitleStyle: CSSProperties = {
    opacity: loaded ? 1 : 0,
    transition: "opacity 800ms ease 1000ms",
  };

  return (
    <main className="text-white">

      {/* Persistent background blobs — matches landing page */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }} aria-hidden>
        <div style={{
          position: "absolute", top: "-10%", left: "-5%",
          width: "500px", height: "500px", borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(123,79,212,0.18) 0%, transparent 70%)",
          filter: "blur(80px)",
          animation: "blobA 12s ease-in-out infinite alternate",
        }} />
        <div style={{
          position: "absolute", bottom: "-10%", right: "-5%",
          width: "400px", height: "400px", borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(212,168,67,0.12) 0%, transparent 70%)",
          filter: "blur(100px)",
          animation: "blobB 15s ease-in-out infinite alternate",
        }} />
        <div style={{
          position: "absolute", top: "40%", right: "10%",
          width: "300px", height: "300px", borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(123,79,212,0.10) 0%, transparent 70%)",
          filter: "blur(60px)",
          animation: "blobC 18s ease-in-out infinite alternate",
        }} />
      </div>

      <style>{`
        @keyframes blobA { from { transform: translate(0,0) scale(1); } to { transform: translate(40px,60px) scale(1.1); } }
        @keyframes blobB { from { transform: translate(0,0) scale(1); } to { transform: translate(-50px,-40px) scale(1.08); } }
        @keyframes blobC { from { transform: translate(0,0) scale(1); } to { transform: translate(30px,-50px) scale(1.05); } }
      `}</style>

      {/* ── Hero ── */}
      <section className="min-h-screen flex items-center justify-center relative z-10 overflow-hidden">
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(ellipse at center, rgba(212,168,67,0.04) 0%, transparent 70%)", filter: "blur(120px)" }}
          aria-hidden
        />
        <div className="text-center px-6 relative z-10">
          <h1 className="text-6xl md:text-7xl font-bold text-white tracking-tight" style={heroTitleStyle}>
            Our Methodology
          </h1>
          <div style={goldLineStyle} />
          <p className="text-base tracking-[0.25em] uppercase mt-6" style={{ ...subtitleStyle, color: "#71717A" }}>
            How we read gold.
          </p>
        </div>
      </section>

      {/* ── Framework sections ── */}
      {FRAMEWORK.map((item, i) => (
        <div key={item.num}>
          <AnimatedDivider />
          <FrameworkSection item={item} index={i} />
        </div>
      ))}

      <AnimatedDivider />

      {/* ── Stats bar ── */}
      <section
        className="border-y py-16 md:py-20 relative z-10"
        style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.06)" }}
      >
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-12 sm:gap-0">
            {STATS.map((s, i) => (
              <StatItem key={s.label} value={s.value} label={s.label} delay={i * 200} showDivider={i > 0} />
            ))}
          </div>
        </div>
      </section>

      <AnimatedDivider />

      {/* ── Bottom CTA ── */}
      <section className="min-h-[50vh] flex items-center justify-center flex-col px-6 py-24 relative z-10">
        <div ref={ctaReveal.ref} style={zoomStyle(ctaReveal.visible)} className="text-center">
          <h2 className="text-4xl font-bold text-white mb-8">See it for yourself.</h2>
          <Link
            href="/#demo"
            className="inline-block rounded-xl px-8 py-4 text-sm font-bold tracking-[0.04em] bg-[#D4A843] text-black transition hover:brightness-110"
            style={{ boxShadow: "0 0 28px rgba(212,168,67,0.35)" }}
          >
            Try the AI Coach — Free
          </Link>
          <p className="text-sm mt-4" style={{ color: "#D4A843" }}>
            🔒 $14.99 today. Lock $25/mo forever.
          </p>
        </div>
      </section>

    </main>
  );
}
