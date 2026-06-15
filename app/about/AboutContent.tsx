"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import Eyebrow from "@/components/design-system/Eyebrow";
import GlassCard from "@/components/design-system/GlassCard";
import SectionReveal from "@/components/design-system/SectionReveal";
import CTABlock from "@/components/design-system/CTABlock";
import TextReveal from "@/components/TextReveal";
import Parallax from "@/components/Parallax";

const SPRING = "cubic-bezier(0.16,1,0.3,1)";

/* ── Data ── */
const CHAPTERS = [
  {
    num: "01",
    title: "The problem every gold trader knows.",
    goldLine: "Two traders. Countless hours analyzing XAUUSD.",
    body: " Too many indicators, too much noise, not enough discipline. Like most retail traders, they lost before they won — chasing signals, ignoring structure, letting emotion drive decisions.",
  },
  {
    num: "02",
    title: "What changed everything.",
    goldLine: "What changed everything was institutional analysis.",
    body: " ICT, Wyckoff, order flow, macro reading. The best traders in the world don't watch RSI. They watch structure, positioning, and flow. But accessing that level of analysis demanded hours of work every day — and a discipline few retail traders can maintain alone.",
  },
  {
    num: "03",
    title: "So we built it.",
    goldLine: "BullionDesk was built to do that work automatically.",
    body: " An intelligence engine that reads 22+ data sources, applies institutional frameworks, and delivers clear analysis with iron discipline. Not a signal service. Not another indicator. A real trading coach that says no when conditions don't warrant a trade.",
  },
] as const;

const IS_LIST = [
  "AI Trading Coach specialized in XAUUSD",
  "Institutional-grade structure & macro analysis",
  "Structure + Macro + Risk — all in one place",
  "Prop firm guidance for FTMO, E8, Apex & more",
];

const IS_NOT_LIST = [
  "A signal provider with entry/exit prices",
  "Copy trading or trade mirroring",
  "A get-rich-quick scheme",
  "A Telegram group or community",
];

/* ── Chapter section — alternating layout with huge watermark number ── */
function Chapter({ chapter, index }: { chapter: typeof CHAPTERS[number]; index: number }) {
  const isEven = index % 2 === 0;
  return (
    <section className="relative min-h-[70vh] flex items-center overflow-hidden py-20 px-6">
      <Parallax
        speed={0.2}
        className={`absolute top-1/2 -translate-y-1/2 select-none pointer-events-none ${
          isEven ? "left-0 sm:left-4" : "right-0 sm:right-4"
        }`}
      >
        <div className="text-[12rem] sm:text-[16rem] font-extrabold leading-none text-white/[0.04]" aria-hidden>
          {chapter.num}
        </div>
      </Parallax>
      <SectionReveal
        x={isEven ? -60 : 60}
        className={`relative z-10 max-w-2xl w-full mx-auto px-6 ${isEven ? "md:mr-auto md:ml-0 md:text-left" : "md:ml-auto md:mr-0 md:text-right"} text-center`}
      >
        <Eyebrow>{`Chapter ${chapter.num}`}</Eyebrow>
        <TextReveal
          text={chapter.title}
          className="text-3xl md:text-4xl font-bold text-white mt-4 mb-6 leading-tight"
        />
        <p className="text-lg leading-loose" style={{ color: "#A1A1AA" }}>
          <span style={{ color: "rgba(212,168,67,0.80)" }}>{chapter.goldLine}</span>
          {chapter.body}
        </p>
      </SectionReveal>
    </section>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0 mt-[3px]">
      <path d="M3 8.5L6.5 12L13 4" stroke="#D4A843" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0 mt-[3px]">
      <path d="M3 3l10 10M13 3L3 13" stroke="rgba(255,255,255,0.35)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/* ── Main ── */
export default function AboutContent() {
  const [loaded, setLoaded] = useState(false);

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
    margin: "1.5rem auto 0",
  };

  const subtitleStyle: CSSProperties = {
    opacity: loaded ? 1 : 0,
    transition: "opacity 800ms ease 1000ms",
  };

  const eyebrowStyle: CSSProperties = {
    opacity: loaded ? 1 : 0,
    transition: "opacity 800ms ease 400ms",
  };

  return (
    <div className="text-white">

      {/* ── Hero ── */}
      <section className="min-h-screen flex items-center justify-center relative z-10 overflow-hidden">
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(ellipse at center, rgba(212,168,67,0.04) 0%, transparent 70%)", filter: "blur(120px)" }}
          aria-hidden
        />
        <div className="text-center px-6 relative z-10">
          <div style={eyebrowStyle}>
            <Eyebrow>Our Story</Eyebrow>
          </div>
          <h1 className="text-6xl md:text-7xl font-bold text-white tracking-tight mt-4" style={heroTitleStyle}>
            About BullionDesk
          </h1>
          <div style={goldLineStyle} />
          <p className="text-base tracking-[0.25em] uppercase mt-6" style={{ ...subtitleStyle, color: "#71717A" }}>
            Built by traders who got tired of losing.
          </p>
        </div>
      </section>

      {/* ── Three chapters ── */}
      {CHAPTERS.map((chapter, i) => (
        <div key={chapter.num}>
          {i > 0 && (
            <div className="w-full h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent my-16 sm:my-24" />
          )}
          <Chapter chapter={chapter} index={i} />
        </div>
      ))}

      <div className="w-full h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent my-16 sm:my-24" />

      {/* ── IS / IS NOT ── */}
      <section className="py-24 px-6 relative z-10">
        <SectionReveal>
          <TextReveal
            text="What we are. What we're not."
            className="text-2xl font-bold text-white text-center mb-12 flex flex-wrap justify-center"
          />
        </SectionReveal>
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-8">
          <SectionReveal x={-40}>
            <GlassCard variant="purple-border" className="h-full p-8 transition-transform duration-300 hover:-translate-y-1">
              <p className="text-lg font-semibold mb-6" style={{ color: "#D4A843" }}>What we are</p>
              <ul className="space-y-4">
                {IS_LIST.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckIcon />
                    <span className="text-sm leading-relaxed text-[#A1A1AA]">{item}</span>
                  </li>
                ))}
              </ul>
            </GlassCard>
          </SectionReveal>
          <SectionReveal x={40} delay={150}>
            <GlassCard className="h-full p-8 transition-all duration-300 hover:-translate-y-1 hover:border-white/[0.16]">
              <p className="text-lg font-semibold mb-6 text-white/70">What we&apos;re not</p>
              <ul className="space-y-4">
                {IS_NOT_LIST.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CrossIcon />
                    <span className="text-sm leading-relaxed text-white/50">{item}</span>
                  </li>
                ))}
              </ul>
            </GlassCard>
          </SectionReveal>
        </div>
      </section>

      <CTABlock />

    </div>
  );
}
