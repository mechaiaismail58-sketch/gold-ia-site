"use client";

import { useEffect, useRef, useState } from "react";
import Eyebrow from "@/components/design-system/Eyebrow";
import GlassCard from "@/components/design-system/GlassCard";
import ScrollZoom from "@/components/ScrollZoom";
import CTABlock from "@/components/design-system/CTABlock";
import TextReveal from "@/components/TextReveal";

import SplitText from "@/components/ui/reactbits/SplitText";
import GradientText from "@/components/ui/reactbits/GradientText";
import SpotlightCard from "@/components/ui/reactbits/SpotlightCard";
import AnimatedContent from "@/components/ui/reactbits/AnimatedContent";
import ShinyText from "@/components/ui/reactbits/ShinyText";
import CountUp from "@/components/ui/reactbits/CountUp";

const SPRING = "cubic-bezier(0.16,1,0.3,1)";

/* ── Single IntersectionObserver hook (used only for the thin dividers) ── */
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

/* ── Framework section — watermark number + scroll-zoom content ── */
function FrameworkSection({ item, index }: { item: typeof FRAMEWORK[number]; index: number }) {
  return (
    <section
      className="min-h-[80vh] flex items-center relative z-10 overflow-hidden py-20 md:py-0"
    >
      {/* Watermark number */}
      <div
        className={`absolute select-none pointer-events-none top-1/2 -translate-y-1/2 font-bold leading-none ${
          item.numSide === "right" ? "right-0 md:right-8" : "left-0 md:left-8"
        }`}
        style={{ fontSize: "clamp(100px, 18vw, 180px)", color: "rgba(124,58,237,0.15)" }}
        aria-hidden
      >
        {item.num}
      </div>
      {/* Content */}
      <ScrollZoom
        className={`relative z-10 max-w-4xl mx-auto px-6 w-full ${
          index % 2 === 0 ? "md:pr-40" : "md:pl-40"
        }`}
      >
        <SpotlightCard spotlightColor="rgba(212,168,67,0.25)" className="p-8 rounded-2xl">
          <ShinyText text={item.label} speed={3} className="text-xs font-semibold tracking-[0.3em] uppercase text-[#D4A843]" />
          <TextReveal
            text={item.title}
            className="text-3xl md:text-4xl font-bold text-white mt-4 mb-6 leading-tight"
          />
          <p className="text-lg leading-relaxed max-w-2xl" style={{ color: "#A1A1AA" }}>
            {item.desc}
          </p>
        </SpotlightCard>
      </ScrollZoom>
    </section>
  );
}

/* ── Main ── */
export default function MethodologyContent() {
  return (
    <main className="text-white relative">
      <div
        className="pointer-events-none"
        style={{
          position: "fixed",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100vw",
          height: "100vh",
          zIndex: 0,
          background: `
            radial-gradient(ellipse 120% 70% at 50% 0%, rgba(124, 58, 237, 0.20) 0%, transparent 70%),
            radial-gradient(ellipse 80% 50% at 20% 40%, rgba(124, 58, 237, 0.08) 0%, transparent 60%),
            radial-gradient(ellipse 70% 40% at 80% 70%, rgba(212, 168, 67, 0.06) 0%, transparent 60%)`,
        }}
      />

      {/* ── Hero ── */}
      <section className="min-h-screen flex items-center justify-center relative z-10 overflow-hidden">

        <AnimatedContent direction="vertical" distance={80}>
          <div className="text-center px-6 relative z-10">
            <Eyebrow>Our Approach</Eyebrow>
            <SplitText
              text="Our Methodology"
              className="text-6xl md:text-7xl font-bold text-white tracking-tight mt-4"
            />
            <div
              style={{
                width: "64px",
                height: "2px",
                background: "linear-gradient(to right, transparent, #D4A843, transparent)",
                margin: "2rem auto 0",
              }}
            />
            <GradientText
              colors={["#7C3AED", "#D4A843", "#7C3AED"]}
              animationSpeed={3}
              className="text-base tracking-[0.25em] uppercase mt-6 inline-block"
            >
              How we read gold.
            </GradientText>
          </div>
        </AnimatedContent>
      </section>

      {/* ── Framework sections ── */}
      {FRAMEWORK.map((item, i) => (
        <AnimatedContent key={item.num} direction="vertical" distance={60} delay={i * 0.15}>
          <AnimatedDivider />
          <FrameworkSection item={item} index={i} />
        </AnimatedContent>
      ))}

      <AnimatedDivider />

      {/* ── Stats bar ── */}
      <section className="py-24 px-6 relative z-10">
        <AnimatedContent direction="vertical" distance={40}>
          <ScrollZoom>
            <GlassCard className="max-w-5xl mx-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06]">
                {STATS.map((s) => (
                  <div key={s.label} className="flex flex-col items-center text-center px-6 py-10">
                    <p className="text-5xl font-bold" style={{ color: "#D4A843" }}>
                      {s.value === "7" ? (
                        <CountUp to={7} className="text-5xl font-bold" />
                      ) : (
                        s.value
                      )}
                    </p>
                    <p className="text-sm mt-2" style={{ color: "#71717A" }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </GlassCard>
          </ScrollZoom>
        </AnimatedContent>
      </section>

      <AnimatedDivider />

      <CTABlock />

    </main>
  );
}
