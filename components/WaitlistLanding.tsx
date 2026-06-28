"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import DemoChat from "@/components/DemoChat";
import ScrollZoom from "@/components/ScrollZoom";
import ClipReveal from "@/components/ClipReveal";
import CurvedLoop from "@/components/ui/CurvedLoop";
import { PRICING } from "@/lib/pricing";

const HERO_HEADING_WORDS = ["Most", "traders", "blow", "their", "funded", "account", "in", "the", "first", "2", "weeks."];
const HERO_HEADING_GOLD_WORDS = ["Ours", "don't."];

const HERO_STATS = [
  { value: "431", label: "Research trades" },
  { value: "7", label: "Prop firms supported" },
  { value: "24/7", label: "Market coverage" },
];

const TRACK_RECORD_STATS = [
  { value: "431", label: "Research Trades" },
  { value: "69%", label: "Win Rate" },
  { value: "25", label: "Selected Trades" },
];

const PROP_FIRM_LOGOS = [
  { name: "The 5%ers", src: "/logos/the5ers.png" },
  { name: "Apex Trader Funding", src: "/logos/apex.png" },
  { name: "FTMO", src: "/logos/ftmo.png" },
  { name: "E8 Funding", src: "/logos/e8.png" },
  { name: "FundedNext", src: "/logos/fundednext.webp" },
  { name: "Blue Guardian", src: "/logos/blueguardian.jpeg" },
  { name: "Alpha Capital Group", src: "/logos/alphacapital.png" },
];

function revealStyle(inView: boolean, delayMs = 0): CSSProperties {
  return {
    opacity: inView ? 1 : 0,
    transform: inView ? "translateY(0)" : "translateY(40px)",
    transition: `opacity 700ms cubic-bezier(0.25,0.46,0.45,0.94) ${delayMs}ms, transform 700ms cubic-bezier(0.25,0.46,0.45,0.94) ${delayMs}ms`,
    willChange: "opacity, transform",
  };
}

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

function parseStat(raw: string) {
  const match = raw.match(/^(\d+(?:\.\d+)?)(.*)$/);
  if (!match) return null;
  const decimals = match[1].includes(".") ? match[1].split(".")[1].length : 0;
  return { target: parseFloat(match[1]), suffix: match[2], decimals };
}

function useCountUp(raw: string, start: boolean, duration = 1200) {
  const parsed = parseStat(raw);
  // Initial render (SSR + first paint) always shows the final value, so
  // crawlers and no-JS clients see real numbers instead of "0".
  const [display, setDisplay] = useState(raw);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!start || startedRef.current || !parsed) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    startedRef.current = true;
    setDisplay(`${(0).toFixed(parsed.decimals)}${parsed.suffix}`);
    const startTime = performance.now();
    let frame: number;

    function tick(now: number) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = parsed!.target * eased;
      setDisplay(`${current.toFixed(parsed!.decimals)}${parsed!.suffix}`);
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [start, duration]);

  return display;
}

function SplitWord({
  word,
  index,
  ready,
  italic = false,
}: {
  word: string;
  index: number;
  ready: boolean;
  italic?: boolean;
}) {
  return (
    <span
      className={`inline-block overflow-hidden align-bottom pb-[0.08em] ${italic ? "pl-[0.14em] -ml-[0.14em]" : ""}`}
    >
      <span
        className={`inline-block mr-[0.28em] ${ready ? "split-word-enter" : "opacity-0"}`}
        style={{ animationDelay: `${index * 120}ms` }}
      >
        {word}
      </span>
    </span>
  );
}

function HeroStat({
  value,
  label,
  start,
  delay,
}: {
  value: string;
  label: string;
  start: boolean;
  delay: number;
}) {
  const display = useCountUp(value, start);
  return (
    <div
      className="glass-card rounded-2xl px-5 py-3.5 text-center hero-stat-enter min-w-[104px]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="text-[20px] font-extrabold tracking-[-0.02em] text-[#D4A843] tabular-nums">
        {display}
      </div>
      <div className="text-[10px] uppercase tracking-[0.16em] text-[#A1A1AA] mt-0.5">{label}</div>
    </div>
  );
}

function TrackRecordCard({
  value,
  label,
  inView,
  delay,
}: {
  value: string;
  label: string;
  inView: boolean;
  delay: number;
}) {
  const display = useCountUp(value, inView);
  return (
    <div style={revealStyle(inView, delay)}>
      <div className="glass-card rounded-2xl px-5 py-6 text-center transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(212,168,67,0.08)]">
        <div className="text-[24px] sm:text-[28px] font-extrabold tracking-[-0.02em] text-[#D4A843] tabular-nums whitespace-nowrap">
          {display}
        </div>
        <div className="text-[10px] uppercase tracking-[0.16em] text-[#A1A1AA] mt-1.5">{label}</div>
      </div>
    </div>
  );
}

function PropFirmMarquee() {
  const track = [...PROP_FIRM_LOGOS, ...PROP_FIRM_LOGOS];
  return (
    <div className="w-full mb-12">
      <p className="text-center text-[12px] text-white/60 tracking-[0.06em] mb-5">
        Compatible with 7 major prop firms
      </p>
      <div
        className="overflow-hidden w-full"
        style={{
          maskImage: "linear-gradient(to right, transparent, black 12%, black 88%, transparent)",
          WebkitMaskImage: "linear-gradient(to right, transparent, black 12%, black 88%, transparent)",
        }}
      >
        <div className="flex items-center gap-14 w-max" style={{ animation: "prop-marquee 30s linear infinite" }}>
          {track.map((firm, i) => (
            <motion.div
              key={`${firm.name}-${i}`}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="relative h-[50px] w-[140px] shrink-0"
            >
              <Image
                src={firm.src}
                alt={firm.name}
                fill
                sizes="140px"
                className={`object-contain ${firm.name === "FTMO" ? "prop-logo-ftmo" : "prop-logo-color"}`}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function WaitlistLanding() {
  const [heroReady, setHeroReady] = useState(false);
  const trackSection = useInView<HTMLDivElement>(0.15);

  // Page-level parallax for decorative blobs (move slower than content).
  const { scrollYProgress: blobScroll } = useScroll();
  const blobY = useTransform(blobScroll, [0, 1], [0, -200]);

  useEffect(() => {
    setTimeout(() => {
      if (window.location.hash) {
        const el = document.querySelector(window.location.hash);
        if (el) { el.scrollIntoView({ behavior: "smooth" }); return; }
      }
      window.scrollTo({ top: 0, behavior: "instant" });
    }, 0);
    const id = requestAnimationFrame(() => setHeroReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="text-[#F5F5F5] flex flex-col items-center px-4 pt-10 animate-fade-in relative">

      <style>{`
        @keyframes prop-marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes badge-pulse {
          0%, 100% { opacity: 0.7; }
          50%      { opacity: 1; }
        }
        .badge-pulse {
          animation: badge-pulse 2s ease-in-out infinite;
        }
        .prop-logo-ftmo {
          filter: grayscale(1) brightness(1.7) contrast(0.7);
          opacity: 0.85;
          transition: opacity 300ms ease;
        }
        .prop-logo-ftmo:hover {
          opacity: 1;
        }
        .prop-logo-color {
          opacity: 0.85;
          transition: opacity 300ms ease, transform 300ms ease;
        }
        .prop-logo-color:hover {
          opacity: 1;
          transform: scale(1.05);
        }
        @keyframes cta-pulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.02); }
        }
        .cta-primary {
          animation: cta-pulse 3s ease-in-out infinite;
          box-shadow: 0 0 25px rgba(212,168,67,0.3);
          transition: transform 200ms ease, box-shadow 200ms ease;
        }
        .cta-primary:hover {
          animation: none;
          transform: scale(1.03);
          box-shadow: 0 0 25px rgba(212,168,67,0.5);
        }
      `}</style>

      {/* Subtle noise texture */}
      <div className="pointer-events-none fixed inset-0 -z-30 noise-overlay" />

      <div className="w-full max-w-lg">

        {/* ── Logo ── */}
        <div className="text-center mb-12">
          <p className="text-[17px] tracking-[0.22em] uppercase text-[#F5F5F5] font-light">
            Bullion <span className="text-[#D4A843]">Desk</span>
          </p>
          <p className="mt-2 text-[10px] tracking-[0.18em] uppercase text-[#A1A1AA]">
            AI Gold Trading Coach
          </p>
        </div>

        {/* ── Secondary nav links ── */}
        <div className="flex justify-center gap-3 mb-7">
          <a
            href="/methodology"
            className="rounded-xl px-4 py-2.5 text-[11px] tracking-[0.10em] uppercase border border-[rgba(212,168,67,0.4)] text-[#D4A843] transition hover:border-[rgba(212,168,67,0.85)] hover:bg-[rgba(212,168,67,0.07)]"
          >
            Our Methodology →
          </a>
          <a
            href="/about"
            className="rounded-xl px-4 py-2.5 text-[11px] tracking-[0.10em] uppercase border border-[rgba(212,168,67,0.4)] text-[#D4A843] transition hover:border-[rgba(212,168,67,0.85)] hover:bg-[rgba(212,168,67,0.07)]"
          >
            About Us →
          </a>
        </div>

        {/* ── Badge ── */}
        <div className="text-center mb-7">
          <span className="badge-pulse inline-flex items-center gap-2 rounded-full border border-[#D4A843] border-opacity-30 bg-[rgba(212,168,67,0.06)] px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D4A843] animate-pulse shrink-0" />
            <span className="text-[10px] font-mono tracking-[0.18em] uppercase text-[#D4A843]">
              Beta — Limited Spots
            </span>
          </span>
        </div>

        {/* ── Hero — py-24 for breathing room ── */}
        <div className="text-center pt-16 pb-12 relative">
          <motion.div
            className="pointer-events-none absolute left-1/2 top-1/2 -ml-[240px] -mt-[170px] h-[340px] w-[480px] -z-10"
            style={{ y: blobY, background: "radial-gradient(ellipse at center, rgba(212,168,67,0.10) 0%, rgba(212,168,67,0) 65%)" }}
          />

          <motion.div
            initial={{ opacity: 0, y: 80, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 1, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <h1
              className="text-[30px] sm:text-[44px] leading-[1.08] tracking-[-0.03em] font-extrabold mb-6"
              aria-label="Most traders blow their funded account in the first 2 weeks. Ours don't."
            >
              <span aria-hidden="true">
                {HERO_HEADING_WORDS.map((w, i) => (
                  <SplitWord key={`h-${i}`} word={w} index={i} ready={heroReady} />
                ))}
                <span className="text-[#D4A843] italic">
                  {HERO_HEADING_GOLD_WORDS.map((w, i) => (
                    <SplitWord
                      key={`g-${i}`}
                      word={w}
                      index={HERO_HEADING_WORDS.length + 2 + i}
                      ready={heroReady}
                      italic
                    />
                  ))}
                </span>
              </span>
            </h1>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <p className="text-[16px] text-[#A1A1AA] leading-[1.7] max-w-[46ch] mx-auto">
              You know the pattern. One bad session turns into revenge trades, your stop losses get wider, and by Friday your funded account is gone. BullionDesk watches your trading in real time and tells you when you’re about to do it again — before the drawdown hits.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.9, ease: [0.25, 0.1, 0.25, 1] }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 mt-8"
          >
            {HERO_STATS.map((s, i) => (
              <HeroStat key={s.label} value={s.value} label={s.label} start={heroReady} delay={700 + i * 150} />
            ))}
          </motion.div>
        </div>

        {/* ── Prop firm logos ── */}
        <ScrollZoom>
          <PropFirmMarquee />
        </ScrollZoom>

        {/* ── CTAs ── */}
        <ScrollZoom>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-3">
            <Link
              href="/signup"
              className="cta-primary w-full sm:w-auto rounded-xl py-4 px-8 text-lg font-bold tracking-[0.02em] bg-[#D4A843] text-black flex items-center justify-center"
            >
              Stop Blowing Funded Accounts
            </Link>
            <button
              onClick={() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })}
              className="w-full sm:w-auto rounded-xl px-5 py-2.5 text-[12px] tracking-[0.06em] font-medium border border-[#1A1A1A] text-[#A1A1AA] hover:border-[rgba(212,168,67,0.35)] hover:text-[#F5F5F5] transition min-h-[40px]"
            >
              Try the AI Coach — Free
            </button>
          </div>
          <p className="text-center text-[11px] text-[#A1A1AA]/70 mb-2">
            No signals · No BS · Just clarity
          </p>
          <div className="text-center mb-16">
            <p className="text-sm font-medium" style={{ color: "#D4A843" }}>{PRICING.betaLine}</p>
            <p className="text-xs font-normal mt-1" style={{ color: "#71717A" }}>{PRICING.urgencyLine}</p>
          </div>
        </ScrollZoom>

        {/* ── Gradient divider ── */}
        <div
          className="h-[1.5px] w-full max-w-[260px] mx-auto mb-24 rounded-full"
          style={{ background: "linear-gradient(to right, transparent, #7C3AED 35%, #D4A843 65%, transparent)" }}
        />

        {/* ── Demo chat section — fade-in ── */}
        <ClipReveal>
          <div id="demo" className="mb-4">
            <div className="text-center mb-4">
              <h2 className="text-[18px] font-extrabold tracking-[-0.01em] mb-2 gradient-text-gold inline-block">
                Ask it before you take the trade
              </h2>
              <span className="flex items-center justify-center gap-1.5 mb-1">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 pulse-dot-green" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                <span className="text-[10px] uppercase tracking-[0.16em] text-[#A1A1AA]">
                  AI Coach — Online
                </span>
              </span>
              <p className="text-[12px] text-[#A1A1AA] tracking-[0.04em]">
                3 free messages. Find out what your last blown account would’ve heard.
              </p>
            </div>
            <div className="rounded-2xl chat-border-glow">
              <div className="rounded-2xl chat-glow-mixed">
                <DemoChat />
              </div>
            </div>
            <p className="text-center mt-3">
              <Link href="/signup" className="text-[12px] text-[#D4A843] hover:text-[#F5F5F5] transition">
                Want unlimited access? →
              </Link>
            </p>
          </div>
        </ClipReveal>

        {/* ── Curved loop section transition ── */}
        <div className="w-full my-6 sm:my-10" style={{ width: "100vw", marginLeft: "calc(-50vw + 50%)" }}>
          <CurvedLoop
            text="AI Trading Coach ✦ Stop Overtrading ✦ Protect Your Funded Account ✦"
            speed={3}
            curveAmount={220}
            direction="left"
          />
        </div>

        {/* ── Track Record ── */}
        <ScrollZoom>
          <div
            ref={trackSection.ref}
            className="rounded-3xl border border-[#1A1A1A] bg-[#111111] overflow-hidden mb-4 py-2"
          >
            <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(212,168,67,0.45)] to-transparent" />
            <div className="p-6 sm:p-10">
              <div className="text-center mb-8">
                <p className="text-[10px] font-mono uppercase tracking-[0.20em] text-[#D4A843] mb-2">
                  The Track Record We Don’t Hide
                </p>
                <p className="text-[13px] text-[#A1A1AA] leading-relaxed">
                  Every call on XAUUSD — wins and losses — backtested and documented. No cherry-picking, no deleted screenshots.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
                {TRACK_RECORD_STATS.map((s, i) => (
                  <TrackRecordCard
                    key={s.label}
                    value={s.value}
                    label={s.label}
                    inView={trackSection.inView}
                    delay={i * 150}
                  />
                ))}
              </div>
              <p className="text-center text-[11px] text-[#A1A1AA]/60 leading-relaxed">
                Based on backtested research trades on XAUUSD. Past performance does not guarantee future results.
              </p>
            </div>
          </div>
        </ScrollZoom>

        {/* ── Footer (no negative viewport margin — it's the last element, so a
             -100px inset would never trigger at the page bottom) ── */}
        <motion.section
          initial={{ opacity: 0, y: 100 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <p className="text-center text-[11px] text-[#A1A1AA] mb-6 mt-8">
            Bullion Desk © 2026 · AI Gold Trading Coach · Not investment advice
          </p>
        </motion.section>

      </div>
    </div>
  );
}
