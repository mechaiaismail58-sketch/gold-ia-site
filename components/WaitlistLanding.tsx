"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import Image from "next/image";
import Link from "next/link";
import {
  motion,
  MotionConfig,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import DemoChat from "@/components/DemoChat";
import CurvedLoop from "@/components/ui/CurvedLoop";
import { PRICING } from "@/lib/pricing";

/* ============================================================
   BullionDesk — Landing v2
   Règles motion : transform + opacity UNIQUEMENT, zéro blur/filter
   animé, reduced-motion respecté via <MotionConfig>.
   Le layout n'est plus contraint à max-w-lg : chaque section gère
   sa propre largeur dans le conteneur 1200px de PathAwareWrapper.
   ============================================================ */

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const FULL_BLEED: CSSProperties = {
  width: "100vw",
  marginLeft: "calc(-50vw + 50%)",
};

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

/* ---------- Count-up (SSR-safe : rend la valeur finale au premier paint) ---------- */

function parseStat(raw: string) {
  const match = raw.match(/^(\d+(?:\.\d+)?)(.*)$/);
  if (!match) return null;
  const decimals = match[1].includes(".") ? match[1].split(".")[1].length : 0;
  return { target: parseFloat(match[1]), suffix: match[2], decimals };
}

function useCountUp(raw: string, start: boolean, duration = 1200) {
  const parsed = parseStat(raw);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, duration]);

  return display;
}

/* ---------- Mot par mot : chaque mot monte hors de son masque ---------- */

function RevealWord({
  word,
  delay,
  gold = false,
}: {
  word: string;
  delay: number;
  gold?: boolean;
}) {
  return (
    <span
      className={`inline-block overflow-hidden align-bottom pb-[0.08em] ${gold ? "pl-[0.14em] -ml-[0.14em]" : ""}`}
    >
      <motion.span
        className={`inline-block mr-[0.26em] ${gold ? "text-[#D4A843] italic" : ""}`}
        initial={{ y: "110%", opacity: 0 }}
        animate={{ y: "0%", opacity: 1 }}
        transition={{ duration: 0.9, ease: EASE, delay }}
      >
        {word}
      </motion.span>
    </span>
  );
}

/* ---------- Reveal générique au scroll ---------- */

function Reveal({
  children,
  delay = 0,
  y = 28,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.8, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/* ---------- Zoom d'entrée (spring) — le "zoom Apple" au scroll ---------- */

function ZoomIn({
  children,
  from = 0.92,
  className = "",
}: {
  children: ReactNode;
  from?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, scale: from, y: 44 }}
      whileInView={{ opacity: 1, scale: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ type: "spring", stiffness: 90, damping: 18, mass: 0.9 }}
    >
      {children}
    </motion.div>
  );
}

/* ---------- Bouton magnétique — attire le CTA vers le curseur ---------- */

function Magnetic({
  children,
  strength = 0.28,
  className = "",
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 18, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 220, damping: 18, mass: 0.6 });
  const reduce = useReducedMotion();

  function onMove(e: ReactMouseEvent<HTMLDivElement>) {
    if (reduce) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  }

  function onLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ x: sx, y: sy }}
      className={`inline-block ${className}`}
    >
      {children}
    </motion.div>
  );
}

/* ---------- Cartes stats ---------- */

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
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: EASE, delay }}
      className="glass-card rounded-2xl px-6 sm:px-8 py-4 sm:py-5 text-center min-w-[128px] sm:min-w-[160px]"
    >
      <div className="text-[24px] sm:text-[30px] font-extrabold tracking-[-0.02em] text-[#D4A843] tabular-nums">
        {display}
      </div>
      <div className="text-[10px] uppercase tracking-[0.16em] text-[#A1A1AA] mt-1">{label}</div>
    </motion.div>
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
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 32 }}
      transition={{ duration: 0.7, ease: EASE, delay }}
    >
      <div className="glass-card rounded-2xl px-5 py-7 sm:py-8 text-center transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(212,168,67,0.10)]">
        <div className="text-[28px] sm:text-[36px] font-extrabold tracking-[-0.02em] text-[#D4A843] tabular-nums whitespace-nowrap">
          {display}
        </div>
        <div className="text-[10px] uppercase tracking-[0.16em] text-[#A1A1AA] mt-1.5">{label}</div>
      </div>
    </motion.div>
  );
}

/* ---------- Marquee prop firms (pause au survol) ---------- */

function PropFirmMarquee() {
  const track = [...PROP_FIRM_LOGOS, ...PROP_FIRM_LOGOS];
  return (
    <div
      className="marquee overflow-hidden w-full"
      style={{
        maskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
        WebkitMaskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
      }}
    >
      <div className="marquee-track flex items-center gap-14 sm:gap-16 w-max">
        {track.map((firm, i) => (
          <div key={`${firm.name}-${i}`} className="relative h-[48px] sm:h-[54px] w-[140px] sm:w-[150px] shrink-0">
            <Image
              src={firm.src}
              alt={firm.name}
              fill
              sizes="150px"
              className={`object-contain ${firm.name === "FTMO" ? "prop-logo-ftmo" : "prop-logo-color"}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================ */

export default function WaitlistLanding() {
  const [heroReady, setHeroReady] = useState(false);

  // Hero façon Apple : la section rétrécit et s'estompe quand on la quitte.
  const heroRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.94]);
  const heroY = useTransform(scrollYProgress, [0, 1], [0, -48]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.85], [1, 0.3]);

  // Track record : déclenche count-up + entrée des cartes.
  const trackRef = useRef<HTMLDivElement | null>(null);
  const trackInView = useInView(trackRef, { once: true, margin: "-80px" });

  useEffect(() => {
    setTimeout(() => {
      if (window.location.hash) {
        const el = document.querySelector(window.location.hash);
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
          return;
        }
      }
      window.scrollTo({ top: 0, behavior: "instant" });
    }, 0);
    const t = setTimeout(() => setHeroReady(true), 1200);
    return () => clearTimeout(t);
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="w-full text-[#F5F5F5] relative">

        <style>{`
          @keyframes prop-marquee {
            from { transform: translateX(0); }
            to   { transform: translateX(-50%); }
          }
          .marquee-track {
            animation: prop-marquee 32s linear infinite;
          }
          .marquee:hover .marquee-track {
            animation-play-state: paused;
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
          .prop-logo-ftmo:hover { opacity: 1; }
          .prop-logo-color {
            opacity: 0.85;
            transition: opacity 300ms ease, transform 300ms ease;
          }
          .prop-logo-color:hover {
            opacity: 1;
            transform: scale(1.05);
          }
        `}</style>

        {/* ══════════ HERO — pleine largeur, cinématique ══════════ */}
        <motion.section
          ref={heroRef}
          style={{ scale: heroScale, y: heroY, opacity: heroOpacity }}
          className="relative text-center pt-10 sm:pt-16 pb-14 sm:pb-20"
        >
          {/* Halo doré statique derrière le titre — gradient sans filtre */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 h-[420px] w-[min(720px,92vw)] -z-10"
            style={{ background: "radial-gradient(ellipse at center, rgba(212,168,67,0.10) 0%, rgba(124,58,237,0.05) 45%, transparent 70%)" }}
          />

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
            className="mb-8 sm:mb-10"
          >
            <span className="badge-pulse inline-flex items-center gap-2 rounded-full border border-[#D4A843] border-opacity-30 bg-[rgba(212,168,67,0.06)] px-4 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#D4A843] animate-pulse shrink-0" />
              <span className="text-[10px] font-mono tracking-[0.18em] uppercase text-[#D4A843]">
                Beta — Limited Spots
              </span>
            </span>
          </motion.div>

          {/* Titre — chaque mot monte hors de son masque */}
          <h1
            className="mx-auto max-w-[1050px] text-[38px] sm:text-[54px] md:text-[66px] lg:text-[76px] leading-[1.04] tracking-[-0.035em] font-extrabold mb-6 sm:mb-8"
            aria-label="Most traders blow their funded account in the first 2 weeks. Ours don't."
          >
            <span aria-hidden="true">
              {HERO_HEADING_WORDS.map((w, i) => (
                <RevealWord key={`h-${i}`} word={w} delay={0.15 + i * 0.06} />
              ))}
              {HERO_HEADING_GOLD_WORDS.map((w, i) => (
                <RevealWord
                  key={`g-${i}`}
                  word={w}
                  delay={0.4 + (HERO_HEADING_WORDS.length + i) * 0.06}
                  gold
                />
              ))}
            </span>
          </h1>

          {/* Sous-texte */}
          <motion.p
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 1.15 }}
            className="text-[16px] sm:text-[18px] text-[#A1A1AA] leading-[1.7] max-w-[52ch] mx-auto"
          >
            You know the pattern. One bad session turns into revenge trades, your stop losses get
            wider, and by Friday your funded account is gone. BullionDesk watches your trading in
            real time and tells you when you&rsquo;re about to do it again — before the drawdown hits.
          </motion.p>

          {/* CTAs — remontés dans le hero, au-dessus de la ligne de flottaison */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 1.3 }}
            className="mt-9 sm:mt-11 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-5"
          >
            <Magnetic className="w-full sm:w-auto">
              <Link
                href="/signup"
                className="group w-full sm:w-auto rounded-2xl py-4 px-9 text-[15px] sm:text-lg font-bold tracking-[0.02em] bg-[#D4A843] text-black inline-flex items-center justify-center gap-2 shadow-[0_0_28px_rgba(212,168,67,0.28)] hover:shadow-[0_0_45px_rgba(212,168,67,0.45)] hover:scale-[1.02] transition-[transform,box-shadow] duration-300"
              >
                Stop Blowing Funded Accounts
                <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
              </Link>
            </Magnetic>
            <button
              onClick={() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })}
              className="w-full sm:w-auto rounded-xl px-5 py-3 text-[12px] tracking-[0.06em] font-medium border border-[#1A1A1A] text-[#A1A1AA] hover:border-[rgba(212,168,67,0.35)] hover:text-[#F5F5F5] transition min-h-[44px]"
            >
              Try the AI Coach — Free
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, ease: EASE, delay: 1.45 }}
          >
            <p className="text-[11px] text-[#A1A1AA]/70 mt-5">No signals · No BS · Just clarity</p>
            <p className="text-sm font-medium mt-3" style={{ color: "#D4A843" }}>{PRICING.betaLine}</p>
            <p className="text-xs font-normal mt-1" style={{ color: "#71717A" }}>{PRICING.urgencyLine}</p>
          </motion.div>

          {/* Stats — count-up */}
          <div className="mt-10 sm:mt-12 flex flex-row flex-wrap items-center justify-center gap-3 sm:gap-5">
            {HERO_STATS.map((s, i) => (
              <HeroStat key={s.label} value={s.value} label={s.label} start={heroReady} delay={1.5 + i * 0.12} />
            ))}
          </div>
        </motion.section>

        {/* ══════════ MARQUEE prop firms — pleine largeur écran ══════════ */}
        <Reveal>
          <div style={FULL_BLEED} className="mb-6">
            <p className="text-center text-[12px] text-white/60 tracking-[0.06em] mb-6">
              Compatible with 7 major prop firms
            </p>
            <PropFirmMarquee />
          </div>
        </Reveal>

        {/* ── Séparateur ── */}
        <div
          className="h-[1.5px] w-full max-w-[280px] mx-auto my-16 sm:my-24 rounded-full"
          style={{ background: "linear-gradient(to right, transparent, #7C3AED 35%, #D4A843 65%, transparent)" }}
        />

        {/* ══════════ DÉMO — la pièce maîtresse, zoom spring à l'entrée ══════════ */}
        <section id="demo" className="mx-auto w-full max-w-[760px] mb-6">
          <Reveal className="text-center mb-6">
            <p className="text-[11px] font-mono uppercase tracking-[0.24em] text-[#D4A843] mb-3">
              Live demo
            </p>
            <h2 className="text-[24px] sm:text-[32px] font-extrabold tracking-[-0.02em] mb-3">
              Ask it <span className="font-serif italic font-medium text-[#D4A843]">before</span> you take the trade
            </h2>
            <span className="flex items-center justify-center gap-1.5 mb-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 pulse-dot-green" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span className="text-[10px] uppercase tracking-[0.16em] text-[#A1A1AA]">
                AI Coach — Online
              </span>
            </span>
            <p className="text-[12px] text-[#A1A1AA] tracking-[0.04em]">
              3 free messages. Find out what your last blown account would&rsquo;ve heard.
            </p>
          </Reveal>

          <ZoomIn from={0.9}>
            <div className="rounded-2xl chat-border-glow">
              <div
                className="rounded-2xl"
                style={{
                  boxShadow:
                    "0 0 0 1px rgba(212,168,67,0.28), 0 0 60px rgba(124,58,237,0.18), 0 0 110px rgba(212,168,67,0.09)",
                }}
              >
                <DemoChat />
              </div>
            </div>
          </ZoomIn>

          <p className="text-center mt-4">
            <Link href="/signup" className="text-[12px] text-[#D4A843] hover:text-[#F5F5F5] transition">
              Want unlimited access? →
            </Link>
          </p>
        </section>

        {/* ══════════ Ticker courbe — pleine largeur ══════════ */}
        <div className="my-10 sm:my-14" style={FULL_BLEED}>
          <CurvedLoop
            text="AI Trading Coach ✦ Stop Overtrading ✦ Protect Your Funded Account ✦"
            speed={3}
            curveAmount={220}
            direction="left"
          />
        </div>

        {/* ══════════ TRACK RECORD ══════════ */}
        <section ref={trackRef} className="mx-auto w-full max-w-[900px] mb-10">
          <ZoomIn from={0.96}>
            <div className="rounded-3xl border border-[#1A1A1A] bg-[#111111] overflow-hidden py-2">
              <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(212,168,67,0.45)] to-transparent" />
              <div className="p-7 sm:p-12">
                <div className="text-center mb-9">
                  <p className="text-[11px] font-mono uppercase tracking-[0.24em] text-[#D4A843] mb-3">
                    Proof, not promises
                  </p>
                  <h2 className="text-[24px] sm:text-[32px] font-extrabold tracking-[-0.02em] mb-3">
                    The track record <span className="font-serif italic font-medium text-[#D4A843]">we don&rsquo;t hide</span>
                  </h2>
                  <p className="text-[13px] sm:text-[14px] text-[#A1A1AA] leading-relaxed max-w-[52ch] mx-auto">
                    Every call on XAUUSD — wins and losses — backtested and documented.
                    No cherry-picking, no deleted screenshots.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3 sm:gap-5 mb-7">
                  {TRACK_RECORD_STATS.map((s, i) => (
                    <TrackRecordCard
                      key={s.label}
                      value={s.value}
                      label={s.label}
                      inView={trackInView}
                      delay={i * 0.15}
                    />
                  ))}
                </div>
                <p className="text-center text-[11px] text-[#A1A1AA]/60 leading-relaxed">
                  Based on backtested research trades on XAUUSD. Past performance does not guarantee future results.
                </p>
              </div>
            </div>
          </ZoomIn>
        </section>

        {/* ══════════ CTA FINAL — la page ne meurt plus en silence ══════════ */}
        <section className="text-center pt-10 sm:pt-16 pb-6">
          <div className="purple-shimmer-line max-w-[420px] mx-auto mb-14 sm:mb-16" />
          <Reveal>
            <h2 className="mx-auto max-w-[16ch] text-[30px] sm:text-[44px] md:text-[52px] leading-[1.08] tracking-[-0.03em] font-extrabold mb-8">
              The next drawdown is <span className="font-serif italic font-medium text-[#D4A843]">optional.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.15}>
            <Magnetic>
              <Link
                href="/signup"
                className="group rounded-2xl py-4 px-9 text-[15px] sm:text-lg font-bold tracking-[0.02em] bg-[#D4A843] text-black inline-flex items-center justify-center gap-2 shadow-[0_0_28px_rgba(212,168,67,0.28)] hover:shadow-[0_0_45px_rgba(212,168,67,0.45)] hover:scale-[1.02] transition-[transform,box-shadow] duration-300"
              >
                Stop Blowing Funded Accounts
                <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
              </Link>
            </Magnetic>
            <p className="text-sm font-medium mt-6" style={{ color: "#D4A843" }}>{PRICING.betaLine}</p>
            <p className="text-xs font-normal mt-1" style={{ color: "#71717A" }}>{PRICING.urgencyLine}</p>
          </Reveal>
        </section>

      </div>
    </MotionConfig>
  );
}
