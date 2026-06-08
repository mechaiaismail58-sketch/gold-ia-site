"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 mt-0.5">
      <circle cx="7" cy="7" r="6.5" stroke="rgba(212,175,55,0.35)" />
      <path d="M4 7l2 2 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 mt-0.5">
      <circle cx="7" cy="7" r="6.5" stroke="rgba(239,68,68,0.3)" />
      <path d="M4.5 4.5l5 5M9.5 4.5l-5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

const STORY_BLOCKS = [
  {
    tag: "The Problem",
    text: "Two traders. Countless hours analyzing XAUUSD. Too many indicators, too much noise, not enough discipline. Like most retail traders, they lost before they won — chasing signals, ignoring structure, letting emotion drive decisions.",
  },
  {
    tag: "The Discovery",
    text: "What changed everything was institutional analysis — ICT, Wyckoff, order flow, macro reading. The best traders in the world don't watch RSI. They watch structure, positioning, and flow. But accessing that level of analysis demanded hours of work every day and a discipline few retail traders can maintain alone.",
  },
  {
    tag: "The Solution",
    text: "BullionDesk was built to do that work automatically. An intelligence engine that reads 22+ data sources, applies institutional frameworks, and delivers clear analysis with iron discipline. Not a signal service. Not another indicator. A real trading coach that says no when conditions don't warrant a trade.",
  },
];

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

/* ── Reveal-on-scroll via IntersectionObserver — fires once at threshold 0.15 ── */
function useInView<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.unobserve(el);
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, inView };
}

/* Fade-in + slide-up — translateY(40px) → 0, opacity 0 → 1, 600ms ease-out */
function revealStyle(inView: boolean, delayMs = 0): CSSProperties {
  return {
    opacity: inView ? 1 : 0,
    transform: inView ? "translateY(0)" : "translateY(40px)",
    transition: `opacity 600ms ease-out ${delayMs}ms, transform 600ms ease-out ${delayMs}ms`,
    willChange: "opacity, transform",
  };
}

/* Card reveal — fade + slide-up + scale-in (0.97 → 1.0), so cards feel like they grow into place */
function cardRevealStyle(inView: boolean, delayMs = 0): CSSProperties {
  return {
    opacity: inView ? 1 : 0,
    transform: inView ? "translateY(0) scale(1)" : "translateY(40px) scale(0.97)",
    transition: `opacity 600ms ease-out ${delayMs}ms, transform 600ms ease-out ${delayMs}ms`,
    willChange: "opacity, transform",
  };
}

/* Staggered list-item reveal — small fade + slide, 100ms apart */
function listItemStyle(inView: boolean, delayMs = 0): CSSProperties {
  return {
    opacity: inView ? 1 : 0,
    transform: inView ? "translateY(0)" : "translateY(8px)",
    transition: `opacity 400ms ease-out ${delayMs}ms, transform 400ms ease-out ${delayMs}ms`,
  };
}

function GradientDivider() {
  return (
    <div
      className="h-[1.5px] w-full max-w-[260px] mx-auto my-2 rounded-full"
      style={{ background: "linear-gradient(to right, transparent, #7C3AED 35%, #D4A843 65%, transparent)" }}
    />
  );
}

function GlassPanel({
  children,
  inView,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  inView: boolean;
  delay?: number;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/5 bg-[rgba(17,17,17,0.6)] backdrop-blur-xl overflow-hidden transition-[border-color,box-shadow] duration-300 hover:border-white/10 hover:shadow-[0_0_20px_rgba(212,168,67,0.08)] ${className}`}
      style={cardRevealStyle(inView, delay)}
    >
      {children}
    </div>
  );
}

export default function AboutPage() {
  const hero = useInView<HTMLElement>();
  const story = useInView<HTMLElement>();
  const compare = useInView<HTMLElement>();
  const cta = useInView<HTMLElement>();

  return (
    <div className="text-white space-y-8">

      {/* ── Section 1 — Hero ── */}
      <section
        ref={hero.ref}
        style={revealStyle(hero.inView)}
        className="rounded-3xl border border-white/5 bg-[rgba(17,17,17,0.6)] backdrop-blur-xl overflow-hidden"
      >
        <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(212,168,67,0.45)] to-transparent" />
        <div className="p-8 sm:p-12">
          <p className="text-[10px] tracking-[0.22em] uppercase text-[#A1A1AA] mb-5">
            About
          </p>
          <h1 className="text-[32px] sm:text-[48px] leading-[1.06] tracking-[-0.03em] font-extrabold text-[#D4A843] mb-4">
            About BullionDesk
          </h1>
          <p className="text-[16px] sm:text-[18px] text-white/55 tracking-[-0.01em]">
            Built by traders, for traders.
          </p>
        </div>
      </section>

      <GradientDivider />

      {/* ── Section 2 — The Story — staggered ── */}
      <section ref={story.ref} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {STORY_BLOCKS.map((block, i) => (
          <GlassPanel key={block.tag} inView={story.inView} delay={i * 150}>
            <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(124,58,237,0.4)] to-transparent" />
            <div className="p-6">
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-white font-semibold mb-3">
                {block.tag}
              </p>
              <p className="text-[13px] text-white/55 leading-[1.7]">
                {block.text}
              </p>
            </div>
          </GlassPanel>
        ))}
      </section>

      <GradientDivider />

      {/* ── Section 3 — What We Are / What We're Not ── */}
      <section ref={compare.ref} className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Left — IS */}
        <GlassPanel inView={compare.inView} delay={0}>
          <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(212,168,67,0.4)] to-transparent" />
          <div className="p-6">
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-white font-semibold mb-4">
              What BullionDesk IS
            </p>
            <ul className="space-y-3">
              {IS_LIST.map((item, i) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-[13px] text-white/80"
                  style={listItemStyle(compare.inView, 200 + i * 100)}
                >
                  <span className="text-[#D4A843]"><CheckIcon /></span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </GlassPanel>

        {/* Right — IS NOT */}
        <GlassPanel inView={compare.inView} delay={150}>
          <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(239,68,68,0.25)] to-transparent" />
          <div className="p-6">
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-red-400/60 mb-4">
              What BullionDesk is NOT
            </p>
            <ul className="space-y-3">
              {IS_NOT_LIST.map((item, i) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-[13px] text-white/50"
                  style={listItemStyle(compare.inView, 350 + i * 100)}
                >
                  <span className="text-red-400/70"><CrossIcon /></span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </GlassPanel>
      </section>

      <GradientDivider />

      {/* ── Section 4 — CTA ── */}
      <section
        ref={cta.ref}
        style={revealStyle(cta.inView)}
        className="rounded-3xl border border-white/5 bg-[rgba(17,17,17,0.6)] backdrop-blur-xl overflow-hidden"
      >
        <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(212,168,67,0.4)] to-transparent" />
        <div className="p-8 sm:p-12 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-[22px] sm:text-[28px] leading-[1.15] tracking-[-0.02em] font-extrabold text-[#D4A843] mb-1.5">
              Ready to trade with clarity?
            </h2>
            <p className="text-[13px] text-white/55">
              3 free messages. No signup required.
            </p>
          </div>
          <a
            href="/#demo"
            className="shrink-0 rounded-xl px-6 py-3 text-[12px] tracking-[0.10em] uppercase font-medium border border-[rgba(212,168,67,0.55)] text-[#D4A843] transition hover:border-[rgba(212,168,67,0.95)] hover:bg-[rgba(212,168,67,0.08)] whitespace-nowrap"
          >
            Try it free →
          </a>
        </div>
      </section>

    </div>
  );
}
