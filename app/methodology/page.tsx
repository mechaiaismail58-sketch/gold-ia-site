"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

const FRAMEWORK_CARDS = [
  {
    title: "Market Structure",
    desc: "Higher timeframe bias, key levels, orderblocks, and Fair Value Gaps. Every analysis starts with structure — mid-range entries don't exist here.",
  },
  {
    title: "Macro Analysis",
    desc: "DXY, real yields, Fed policy, ETF flows, and intermarket correlations. Macro sets the context; structure provides the precision.",
  },
  {
    title: "Risk Management",
    desc: "Structural position sizing, R-multiple tracking, and drawdown limits enforced automatically. Risk is always proportional, never emotional.",
  },
  {
    title: "Psychology & Discipline",
    desc: "Bias detection, overtrading alerts, and consistency scoring built into every response. The AI says wait more often than it validates conditions.",
  },
];

const DIFFERENTIATORS = [
  {
    value: "22+",
    label: "Data Sources",
    desc: "Price, macro, COT, ETF flows, order flow, news — all processed on every request.",
  },
  {
    value: "No Signals",
    label: "Just Clarity",
    desc: "No entry prices, no stop targets. Analysis and education only — the discipline stays with you.",
  },
  {
    value: "Prop Firm",
    label: "Ready",
    desc: "FTMO, E8, Apex, The5ers — DD rules, phase guidance, and consistency logic built in.",
  },
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

function GlassCard({
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

export default function MethodologyPage() {
  const hero = useInView<HTMLElement>();
  const framework = useInView<HTMLDivElement>();
  const differentiators = useInView<HTMLDivElement>();
  const cta = useInView<HTMLElement>();

  return (
    <main className="text-white space-y-8">

      {/* ── Hero ── */}
      <section
        ref={hero.ref}
        style={revealStyle(hero.inView)}
        className="rounded-3xl border border-white/5 bg-[rgba(17,17,17,0.6)] backdrop-blur-xl overflow-hidden"
      >
        <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(212,168,67,0.45)] to-transparent" />
        <div className="p-8 sm:p-12">
          <p className="text-[10px] tracking-[0.22em] uppercase text-[#A1A1AA] mb-5">
            Methodology
          </p>
          <h1 className="text-[32px] sm:text-[48px] leading-[1.06] tracking-[-0.03em] font-extrabold text-[#D4A843] mb-4">
            Our Methodology
          </h1>
          <p className="text-[16px] sm:text-[18px] text-white/55 tracking-[-0.01em]">
            How BullionDesk analyzes gold.
          </p>
        </div>
      </section>

      <GradientDivider />

      {/* ── The Framework — 2×2 grid, staggered ── */}
      <div ref={framework.ref}>
        <p
          className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#D4A843] font-extrabold mb-4 px-1"
          style={revealStyle(framework.inView)}
        >
          The Framework
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FRAMEWORK_CARDS.map((card, i) => (
            <GlassCard key={card.title} inView={framework.inView} delay={i * 150}>
              <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(124,58,237,0.4)] to-transparent" />
              <div className="p-6">
                <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-white font-semibold mb-2">
                  {card.title}
                </p>
                <p className="text-[13px] text-white/55 leading-[1.7]">
                  {card.desc}
                </p>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>

      <GradientDivider />

      {/* ── What Makes Us Different — 3 columns, staggered ── */}
      <div ref={differentiators.ref}>
        <p
          className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#D4A843] font-extrabold mb-4 px-1"
          style={revealStyle(differentiators.inView)}
        >
          What Makes Us Different
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {DIFFERENTIATORS.map((d, i) => (
            <GlassCard key={d.label} inView={differentiators.inView} delay={i * 150}>
              <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(212,168,67,0.3)] to-transparent" />
              <div className="p-6">
                <p className="text-[28px] font-extrabold tracking-[-0.02em] text-white leading-none mb-1">
                  {d.value}
                </p>
                <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/50 mb-3">
                  {d.label}
                </p>
                <p className="text-[12px] text-white/55 leading-[1.65]">
                  {d.desc}
                </p>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>

      <GradientDivider />

      {/* ── CTA ── */}
      <section
        ref={cta.ref}
        style={revealStyle(cta.inView)}
        className="rounded-3xl border border-white/5 bg-[rgba(17,17,17,0.6)] backdrop-blur-xl overflow-hidden"
      >
        <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(212,168,67,0.4)] to-transparent" />
        <div className="p-8 sm:p-12 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-[22px] sm:text-[28px] leading-[1.15] tracking-[-0.02em] font-extrabold text-[#D4A843] mb-1.5">
              See it in action.
            </h2>
            <p className="text-[13px] text-white/55">
              3 free messages. No signup required.
            </p>
          </div>
          <a
            href="/#demo"
            className="shrink-0 rounded-xl px-6 py-3 text-[12px] tracking-[0.10em] uppercase font-medium border border-[rgba(212,168,67,0.55)] text-[#D4A843] transition hover:border-[rgba(212,168,67,0.95)] hover:bg-[rgba(212,168,67,0.08)] whitespace-nowrap"
          >
            See it in action →
          </a>
        </div>
      </section>

    </main>
  );
}
