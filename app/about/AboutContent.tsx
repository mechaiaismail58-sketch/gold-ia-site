"use client";

import Eyebrow from "@/components/design-system/Eyebrow";
import ScrollZoom from "@/components/ScrollZoom";
import CTABlock from "@/components/design-system/CTABlock";
import TextReveal from "@/components/TextReveal";
import Aurora from "@/components/ui/reactbits/Aurora";
import SplitText from "@/components/ui/reactbits/SplitText";
import GradientText from "@/components/ui/reactbits/GradientText";
import SpotlightCard from "@/components/ui/reactbits/SpotlightCard";
import AnimatedContent from "@/components/ui/reactbits/AnimatedContent";

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
      {/* Watermark number — plain white, near-invisible, no decoration */}
      <div
        className={`absolute top-1/2 -translate-y-1/2 select-none pointer-events-none text-[12rem] sm:text-[16rem] font-extrabold leading-none text-white/[0.03] ${
          isEven ? "left-0 sm:left-4" : "right-0 sm:right-4"
        }`}
        aria-hidden
      >
        {chapter.num}
      </div>
      <ScrollZoom
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
      </ScrollZoom>
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
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0 mt-[3px] text-red-400/60">
      <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/* ── Main ── */
export default function AboutContent() {
  return (
    <div className="text-white">

      {/* ── Hero ── */}
      <section className="min-h-screen flex items-center justify-center relative z-10 overflow-hidden">
        <Aurora colorStops={["#7C3AED", "#D4A843", "#7C3AED"]} amplitude={1.5} speed={0.5} />
        <AnimatedContent direction="vertical" distance={80}>
          <div className="text-center px-6 relative z-10">
            <Eyebrow>Our Story</Eyebrow>
            <SplitText
              text="About BullionDesk"
              className="text-6xl md:text-7xl font-bold text-white tracking-tight mt-4"
            />
            <div
              className="mx-auto mt-6"
              style={{
                width: "64px",
                height: "2px",
                background: "linear-gradient(to right, transparent, #D4A843, transparent)",
              }}
            />
            <p className="text-base tracking-[0.25em] uppercase mt-6" style={{ color: "#71717A" }}>
              <GradientText colors={["#7C3AED", "#D4A843", "#7C3AED"]} animationSpeed={3}>
                Built by traders who got tired of losing.
              </GradientText>
            </p>
          </div>
        </AnimatedContent>
      </section>

      {/* ── Three chapters ── */}
      {CHAPTERS.map((chapter, i) => (
        <AnimatedContent key={chapter.num} direction="vertical" distance={60} delay={i * 0.15}>
          {i > 0 && (
            <div className="w-full h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent my-16 sm:my-24" />
          )}
          <Chapter chapter={chapter} index={i} />
        </AnimatedContent>
      ))}

      <div className="w-full h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent my-16 sm:my-24" />

      {/* ── IS / IS NOT ── */}
      <section className="py-24 px-6 relative z-10">
        <AnimatedContent direction="vertical" distance={40}>
          <ScrollZoom>
            <SplitText
              text="What we are. What we're not."
              className="text-2xl font-bold text-white text-center mb-12"
            />
          </ScrollZoom>
        </AnimatedContent>
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 items-stretch gap-8">
          <AnimatedContent direction="horizontal" distance={-40} delay={0.1} className="h-full">
            <ScrollZoom className="h-full">
              <SpotlightCard spotlightColor="rgba(34,197,94,0.25)" className="h-full">
                <div className="h-full p-8 rounded-2xl bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] border-l-[3px] border-l-[#D4A843] transition-transform duration-300 hover:-translate-y-1">
                  <p className="text-lg font-semibold mb-6 text-[#D4A843]">What we are</p>
                  <ul className="space-y-4">
                    {IS_LIST.map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <CheckIcon />
                        <span className="text-sm leading-relaxed text-[#A1A1AA]">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </SpotlightCard>
            </ScrollZoom>
          </AnimatedContent>
          <AnimatedContent direction="horizontal" distance={40} delay={0.2} className="h-full">
            <ScrollZoom className="h-full">
              <SpotlightCard spotlightColor="rgba(239,68,68,0.25)" className="h-full">
                <div className="h-full p-8 rounded-2xl bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] border-l-[3px] border-l-red-500/40 transition-transform duration-300 hover:-translate-y-1">
                  <p className="text-lg font-semibold mb-6 text-red-400/80">What we&apos;re not</p>
                  <ul className="space-y-4">
                    {IS_NOT_LIST.map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <CrossIcon />
                        <span className="text-sm leading-relaxed text-white/50">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </SpotlightCard>
            </ScrollZoom>
          </AnimatedContent>
        </div>
      </section>

      <CTABlock />

    </div>
  );
}
