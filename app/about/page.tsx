"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";

const SPRING = "cubic-bezier(0.16,1,0.3,1)";

/* ── IntersectionObserver hook ── */
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

/* ── Style helpers ── */
function zoomStyle(visible: boolean, delay = 0): CSSProperties {
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? "scale(1)" : "scale(0.85)",
    filter: visible ? "blur(0px)" : "blur(8px)",
    transition: `opacity 900ms ${SPRING} ${delay}ms, transform 900ms ${SPRING} ${delay}ms, filter 900ms ${SPRING} ${delay}ms`,
    willChange: "opacity, transform, filter",
  };
}

function slideLeftStyle(visible: boolean, delay = 0): CSSProperties {
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? "translateX(0) scale(1)" : "translateX(100px) scale(0.95)",
    transition: `opacity 800ms ${SPRING} ${delay}ms, transform 800ms ${SPRING} ${delay}ms`,
    willChange: "opacity, transform",
  };
}

function slideRightStyle(visible: boolean, delay = 0): CSSProperties {
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? "translateX(0) scale(1)" : "translateX(-100px) scale(0.95)",
    transition: `opacity 800ms ${SPRING} ${delay}ms, transform 800ms ${SPRING} ${delay}ms`,
    willChange: "opacity, transform",
  };
}

function riseStyle(visible: boolean, delay = 0): CSSProperties {
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0) scale(1)" : "translateY(80px) scale(0.97)",
    transition: `opacity 800ms ${SPRING} ${delay}ms, transform 800ms ${SPRING} ${delay}ms`,
    willChange: "opacity, transform",
  };
}

/* ── Data ── */
const CHAPTERS = [
  {
    num: "CHAPTER 01",
    title: "The problem every gold trader knows.",
    goldLine: "Two traders. Countless hours analyzing XAUUSD.",
    body: " Too many indicators, too much noise, not enough discipline. Like most retail traders, they lost before they won — chasing signals, ignoring structure, letting emotion drive decisions.",
    glowColor: "rgba(212,168,67,0.03)",
    glowPos: "top-0 right-0",
    align: "center" as const,
    variant: "zoom" as const,
  },
  {
    num: "CHAPTER 02",
    title: "What changed everything.",
    goldLine: "What changed everything was institutional analysis.",
    body: " ICT, Wyckoff, order flow, macro reading. The best traders in the world don't watch RSI. They watch structure, positioning, and flow. But accessing that level of analysis demanded hours of work every day — and a discipline few retail traders can maintain alone.",
    glowColor: "rgba(124,58,237,0.04)",
    glowPos: "bottom-0 left-0",
    align: "right" as const,
    variant: "slide-left" as const,
  },
  {
    num: "CHAPTER 03",
    title: "So we built it.",
    goldLine: "BullionDesk was built to do that work automatically.",
    body: " An intelligence engine that reads 22+ data sources, applies institutional frameworks, and delivers clear analysis with iron discipline. Not a signal service. Not another indicator. A real trading coach that says no when conditions don't warrant a trade.",
    glowColor: "rgba(212,168,67,0.03)",
    glowPos: "top-0 right-0",
    align: "center" as const,
    variant: "zoom" as const,
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

/* ── Chapter section ── */
function Chapter({ chapter }: { chapter: typeof CHAPTERS[number] }) {
  const { ref, visible } = useReveal(0.10);
  const [shimmer, setShimmer] = useState(false);
  const isCenter = chapter.align === "center";

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setShimmer(true), 400);
    return () => clearTimeout(t);
  }, [visible]);

  const contentStyle =
    chapter.variant === "zoom"
      ? zoomStyle(visible)
      : slideLeftStyle(visible);

  const glowStyle: CSSProperties = {
    opacity: visible ? 1 : 0,
    background: chapter.glowColor,
    transition: "opacity 1400ms ease 100ms",
  };

  return (
    <section className="min-h-[85vh] flex items-center relative overflow-hidden py-24 md:py-0">
      {/* Glow fades in with content */}
      <div
        className={`absolute ${chapter.glowPos} w-[480px] h-[480px] rounded-full blur-[150px] pointer-events-none`}
        style={glowStyle}
        aria-hidden
      />
      <div
        ref={ref}
        className={`relative z-10 px-6 w-full ${
          isCenter ? "max-w-3xl mx-auto text-center" : "max-w-2xl ml-auto mr-0 text-left"
        }`}
        style={contentStyle}
      >
        <p className="text-xs uppercase tracking-[0.3em] mb-6" style={{ color: "#D4A843" }}>
          {chapter.num}
        </p>
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-8 leading-tight">
          {chapter.title}
        </h2>
        <p className="text-lg leading-loose" style={{ color: "#A1A1AA" }}>
          {/* Gold first sentence — shimmers in 400ms after paragraph */}
          <span
            className={shimmer ? "gold-shimmer" : "gold-shimmer-hidden"}
            style={{ color: "rgba(212,168,67,0.70)" }}
          >
            {chapter.goldLine}
          </span>
          {chapter.body}
        </p>
      </div>
    </section>
  );
}

/* ── Bullet with rise variant ── */
function Bullet({ text, delay, dotColor, textColor }: {
  text: string; delay: number; dotColor: string; textColor: string;
}) {
  const { ref, visible } = useReveal(0.15);
  return (
    <li>
      <div ref={ref} className="flex items-start gap-3" style={riseStyle(visible, delay)}>
        <span className="mt-[9px] h-1.5 w-1.5 rounded-full shrink-0" style={{ background: dotColor }} />
        <span className="text-sm leading-relaxed" style={{ color: textColor }}>{text}</span>
      </div>
    </li>
  );
}

/* ── IS / IS NOT card with animated left border ── */
function IsCard({
  title, items, borderColor, titleColor, dotColor, textColor, slideVariant, delay,
}: {
  title: string;
  items: readonly string[];
  borderColor: string;
  titleColor: string;
  dotColor: string;
  textColor: string;
  slideVariant: "left" | "right";
  delay: number;
}) {
  const { ref, visible } = useReveal(0.15);
  const cardStyle = slideVariant === "right" ? slideRightStyle(visible, delay) : slideLeftStyle(visible, delay);

  return (
    <div ref={ref} style={cardStyle}>
      <div className="p-8 rounded-2xl h-full relative overflow-hidden" style={{ background: "rgba(255,255,255,0.03)" }}>
        {/* Animated left border — draws downward */}
        <div
          className="absolute left-0 top-0 w-[3px]"
          style={{
            background: borderColor,
            height: visible ? "100%" : "0%",
            transition: `height 500ms ${SPRING} ${delay + 200}ms`,
          }}
        />
        <p className="text-lg font-semibold mb-6 pl-2" style={{ color: titleColor }}>
          {title}
        </p>
        <ul className="space-y-4 pl-2">
          {items.map((item, i) => (
            <Bullet key={item} text={item} delay={delay + 300 + i * 120} dotColor={dotColor} textColor={textColor} />
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ── Main ── */
export default function AboutPage() {
  const [loaded, setLoaded] = useState(false);
  const ctaReveal = useReveal(0.2);
  const sectionTitleReveal = useReveal(0.2);

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
    <div className="text-white">

      {/* ── Hero ── */}
      <section className="min-h-screen flex items-center justify-center relative overflow-hidden">
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(ellipse at center, rgba(212,168,67,0.04) 0%, transparent 70%)", filter: "blur(120px)" }}
          aria-hidden
        />
        <div className="text-center px-6 relative z-10">
          <h1 className="text-6xl md:text-7xl font-bold text-white tracking-tight" style={heroTitleStyle}>
            About BullionDesk
          </h1>
          <div style={goldLineStyle} />
          <p className="text-base tracking-[0.25em] uppercase mt-6" style={{ ...subtitleStyle, color: "#71717A" }}>
            Built by traders who got tired of losing.
          </p>
        </div>
      </section>

      {/* ── Three chapters ── */}
      {CHAPTERS.map((chapter) => (
        <div key={chapter.num}>
          <AnimatedDivider />
          <Chapter chapter={chapter} />
        </div>
      ))}

      <AnimatedDivider />

      {/* ── IS / IS NOT ── */}
      <section className="py-24 px-6">
        <div ref={sectionTitleReveal.ref} style={zoomStyle(sectionTitleReveal.visible)}>
          <h2 className="text-2xl font-bold text-white text-center mb-12">
            What we are. What we&apos;re not.
          </h2>
        </div>
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-8">
          <IsCard
            title="What we are"
            items={IS_LIST}
            borderColor="#D4A843"
            titleColor="#D4A843"
            dotColor="#D4A843"
            textColor="#A1A1AA"
            slideVariant="right"
            delay={0}
          />
          <IsCard
            title="What we're not"
            items={IS_NOT_LIST}
            borderColor="rgba(239,68,68,0.5)"
            titleColor="rgba(248,113,113,0.8)"
            dotColor="rgba(239,68,68,0.5)"
            textColor="rgba(255,255,255,0.5)"
            slideVariant="left"
            delay={300}
          />
        </div>
      </section>

      <AnimatedDivider />

      {/* ── Bottom CTA ── */}
      <section className="min-h-[50vh] flex items-center justify-center flex-col px-6 py-24">
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

    </div>
  );
}
