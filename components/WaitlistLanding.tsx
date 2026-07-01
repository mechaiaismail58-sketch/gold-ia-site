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
  useAnimationFrame,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
  type MotionValue,
} from "framer-motion";
import DemoChat from "@/components/DemoChat";
import CurvedLoop from "@/components/ui/CurvedLoop";
import { PRICING } from "@/lib/pricing";

/* ============================================================
   BullionDesk — Landing v3.1 "scroll-driven"
   PRÉREQUIS : dans globals.css, le bloc `html, body` doit utiliser
   `overflow-x: clip;` (PAS `hidden`) — `hidden` sur html/body tue
   position:sticky dans Safari, donc aucune section ne s'épingle.
   Règles : transform + opacity uniquement, zéro blur/filter animé.
   ============================================================ */

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const FULL_BLEED: CSSProperties = {
  width: "100vw",
  marginLeft: "calc(-50vw + 50%)",
};

const HERO_HEADING_WORDS = ["Most", "traders", "blow", "their", "funded", "account", "in", "the", "first", "2", "weeks."];
const HERO_HEADING_GOLD_WORDS = ["Ours", "don't."];

const STATEMENT_WORDS = ["The", "AI", "that", "tells", "you", "not", "to", "trade."];
const STATEMENT_GOLD = new Set([5]);

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

function wrap(min: number, max: number, v: number) {
  const range = max - min;
  const mod = (((v - min) % range) + range) % range;
  return mod + min;
}

/* ---------- Count-up (SSR-safe) ---------- */

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

/* ---------- Mot par mot : monte hors de son masque (entrée hero) ---------- */

function RevealWord({ word, delay, gold = false }: { word: string; delay: number; gold?: boolean }) {
  return (
    <span className={`inline-block overflow-hidden align-bottom pb-[0.08em] ${gold ? "pl-[0.14em] -ml-[0.14em]" : ""}`}>
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

/* ---------- Reveal générique ---------- */

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

/* ---------- Zoom spring à l'entrée (track record) ---------- */

function ZoomIn({ children, from = 0.94, className = "" }: { children: ReactNode; from?: number; className?: string }) {
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

/* ---------- Bouton magnétique ---------- */

function Magnetic({ children, strength = 0.28, className = "" }: { children: ReactNode; strength?: number; className?: string }) {
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
    <motion.div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} style={{ x: sx, y: sy }} className={`inline-block ${className}`}>
      {children}
    </motion.div>
  );
}

/* ---------- CTA principal (partagé hero / final) ---------- */

function PrimaryCTA() {
  return (
    <Magnetic className="w-full sm:w-auto">
      <Link
        href="/signup"
        className="group w-full sm:w-auto rounded-2xl py-4 px-9 text-[15px] sm:text-lg font-bold tracking-[0.02em] bg-[#D4A843] text-black inline-flex items-center justify-center gap-2 shadow-[0_0_28px_rgba(212,168,67,0.28)] hover:shadow-[0_0_45px_rgba(212,168,67,0.45)] hover:scale-[1.02] transition-[transform,box-shadow] duration-300"
      >
        Stop Blowing Funded Accounts
        <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
      </Link>
    </Magnetic>
  );
}

/* ---------- Cartes track record ---------- */

function TrackRecordCard({ value, label, inView, delay }: { value: string; label: string; inView: boolean; delay: number }) {
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

/* ---------- Marquee réactif à la vélocité du scroll ----------
   Suspendu automatiquement hors écran (pas de rAF inutile). ---------- */

function VelocityMarquee() {
  const reduce = useReducedMotion();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onScreen = useInView(containerRef, { margin: "200px" });
  const baseX = useMotionValue(0);
  const { scrollY } = useScroll();
  const scrollVelocity = useVelocity(scrollY);
  const smoothVelocity = useSpring(scrollVelocity, { damping: 50, stiffness: 400 });
  const velocityFactor = useTransform(smoothVelocity, [0, 1000], [0, 4], { clamp: false });
  const skewX = useTransform(smoothVelocity, [-1500, 1500], [-3, 3]);
  const directionRef = useRef(1);
  const x = useTransform(baseX, (v) => `${wrap(-50, 0, v)}%`);

  useAnimationFrame((_, delta) => {
    if (reduce || !onScreen) return;
    let moveBy = directionRef.current * -3.5 * (delta / 1000);
    const vf = velocityFactor.get();
    if (vf < 0) directionRef.current = -1;
    else if (vf > 0) directionRef.current = 1;
    moveBy += directionRef.current * moveBy * vf;
    baseX.set(baseX.get() + moveBy);
  });

  const track = [...PROP_FIRM_LOGOS, ...PROP_FIRM_LOGOS];

  return (
    <motion.div
      ref={containerRef}
      className="overflow-hidden w-full"
      style={{
        skewX: reduce ? 0 : skewX,
        maskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
        WebkitMaskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
      }}
    >
      <motion.div className="flex items-center gap-14 sm:gap-16 w-max py-2" style={{ x: reduce ? "0%" : x }}>
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
      </motion.div>
    </motion.div>
  );
}

/* ---------- Statement scrubbed : chaque mot s'allume au scroll ---------- */

function ScrubWord({
  word,
  index,
  total,
  progress,
  gold,
}: {
  word: string;
  index: number;
  total: number;
  progress: MotionValue<number>;
  gold: boolean;
}) {
  const reduce = useReducedMotion();
  // Tous les mots sont allumés à 75% du pin → le message reste lisible
  // en pleine lumière pendant le dernier quart, au lieu de rester gris.
  const start = 0.05 + (index / total) * 0.7;
  const end = 0.05 + ((index + 1) / total) * 0.7;
  const opacity = useTransform(progress, [start, end], [0.12, 1]);
  return (
    <motion.span
      style={{ opacity: reduce ? 1 : opacity }}
      className={gold ? "font-serif italic font-medium text-[#D4A843]" : ""}
    >
      {word}
    </motion.span>
  );
}

function StatementSection() {
  const ref = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  return (
    <section ref={ref} className="relative h-[160vh]">
      <div className="sticky top-0 h-svh flex flex-col items-center justify-center text-center px-2">
        <p className="text-[11px] font-mono uppercase tracking-[0.24em] text-[#D4A843] mb-6">
          No signals. No BS.
        </p>
        <p className="max-w-[14ch] text-[34px] sm:text-[50px] md:text-[62px] lg:text-[70px] leading-[1.06] tracking-[-0.03em] font-extrabold flex flex-wrap justify-center gap-x-[0.28em] gap-y-[0.08em]">
          {STATEMENT_WORDS.map((w, i) => (
            <ScrubWord
              key={i}
              word={w}
              index={i}
              total={STATEMENT_WORDS.length}
              progress={scrollYProgress}
              gold={STATEMENT_GOLD.has(i)}
            />
          ))}
        </p>
      </div>
    </section>
  );
}

/* ============================================================ */

export default function WaitlistLanding() {
  const reduce = useReducedMotion();

  // HERO épinglé : push-in caméra. Le fondu ne démarre qu'à 70% du pin
  // pour que le texte reste à pleine luminosité tant qu'il est lisible.
  const heroRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress: heroP } = useScroll({ target: heroRef, offset: ["start start", "end end"] });
  const heroScale = useTransform(heroP, [0, 1], [1, 1.12]);
  const heroOpacity = useTransform(heroP, [0.7, 0.98], [1, 0]);

  // DÉMO épinglée : zoom rapide (fini à 35% du pin) puis elle RESTE
  // à taille pleine, nette et cliquable, pendant le reste du pin.
  const demoRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress: demoP } = useScroll({ target: demoRef, offset: ["start start", "end end"] });
  const demoScale = useTransform(demoP, [0, 0.35], [0.55, 1]);
  const demoOpacity = useTransform(demoP, [0, 0.12], [0, 1]);
  const demoY = useTransform(demoP, [0, 0.35], [60, 0]);

  // Track record : count-up + entrée des cartes.
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
  }, []);

  function scrollToDemo() {
    const el = demoRef.current;
    if (!el) return;
    // Atterrit à ~90% d'un écran DANS la section épinglée : la démo est
    // déjà zoomée à pleine taille au lieu d'un écran vide (opacité 0).
    const top = window.scrollY + el.getBoundingClientRect().top + window.innerHeight * 0.9;
    window.scrollTo({ top, behavior: "smooth" });
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="w-full text-[#F5F5F5] relative">

        <style>{`
          @keyframes badge-pulse {
            0%, 100% { opacity: 0.7; }
            50%      { opacity: 1; }
          }
          .badge-pulse { animation: badge-pulse 2s ease-in-out infinite; }
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
          .prop-logo-color:hover { opacity: 1; transform: scale(1.05); }
        `}</style>

        {/* ══════════ HERO ÉPINGLÉ — push-in caméra ══════════ */}
        <section ref={heroRef} className="relative h-[165vh]">
          <motion.div
            style={reduce ? undefined : { scale: heroScale, opacity: heroOpacity }}
            className="sticky top-0 h-svh flex flex-col items-center justify-center text-center will-change-transform"
          >
            {/* Halo statique — gradient, aucun filtre */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[440px] w-[min(760px,92vw)] -z-10"
              style={{ background: "radial-gradient(ellipse at center, rgba(212,168,67,0.10) 0%, rgba(124,58,237,0.05) 45%, transparent 70%)" }}
            />

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
              className="mb-8"
            >
              <span className="badge-pulse inline-flex items-center gap-2 rounded-full border border-[#D4A843] border-opacity-30 bg-[rgba(212,168,67,0.06)] px-4 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#D4A843] animate-pulse shrink-0" />
                <span className="text-[10px] font-mono tracking-[0.18em] uppercase text-[#D4A843]">
                  Beta — Limited Spots
                </span>
              </span>
            </motion.div>

            <h1
              className="mx-auto max-w-[1000px] text-[36px] sm:text-[50px] md:text-[60px] lg:text-[70px] leading-[1.05] tracking-[-0.035em] font-extrabold mb-6 sm:mb-7 px-1"
              aria-label="Most traders blow their funded account in the first 2 weeks. Ours don't."
            >
              <span aria-hidden="true">
                {HERO_HEADING_WORDS.map((w, i) => (
                  <RevealWord key={`h-${i}`} word={w} delay={0.15 + i * 0.06} />
                ))}
                {HERO_HEADING_GOLD_WORDS.map((w, i) => (
                  <RevealWord key={`g-${i}`} word={w} delay={0.4 + (HERO_HEADING_WORDS.length + i) * 0.06} gold />
                ))}
              </span>
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: EASE, delay: 1.15 }}
              className="text-[15px] sm:text-[17px] text-[#A1A1AA] leading-[1.7] max-w-[50ch] mx-auto px-2"
            >
              You know the pattern. One bad session turns into revenge trades, your stop losses get
              wider, and by Friday your funded account is gone. BullionDesk watches your trading in
              real time and tells you when you&rsquo;re about to do it again — before the drawdown hits.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: EASE, delay: 1.3 }}
              className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-5 w-full px-4 sm:px-0 sm:w-auto"
            >
              <PrimaryCTA />
              <button
                onClick={scrollToDemo}
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
          </motion.div>
        </section>

        {/* ══════════ MARQUEE — réactif à la vélocité de ton scroll ══════════ */}
        <Reveal>
          <div style={FULL_BLEED} className="mt-2 mb-6">
            <p className="text-center text-[12px] text-white/60 tracking-[0.06em] mb-6">
              Compatible with 7 major prop firms
            </p>
            <VelocityMarquee />
          </div>
        </Reveal>

        {/* ══════════ STATEMENT — les mots s'allument au scroll ══════════ */}
        <StatementSection />

        {/* ══════════ DÉMO ÉPINGLÉE — zoom scrubbed 0.55 → 1 ══════════ */}
        <section id="demo" ref={demoRef} className="relative h-[200vh]">
          <div className="sticky top-0 h-svh flex items-center justify-center">
            <motion.div
              style={reduce ? undefined : { scale: demoScale, opacity: demoOpacity, y: demoY }}
              className="w-full max-w-[760px] px-1 will-change-transform"
            >
              <div className="text-center mb-6">
                <p className="text-[11px] font-mono uppercase tracking-[0.24em] text-[#D4A843] mb-3">
                  Live demo
                </p>
                <h2 className="text-[24px] sm:text-[30px] font-extrabold tracking-[-0.02em] mb-3">
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
              </div>

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

              <p className="text-center mt-4">
                <Link href="/signup" className="text-[12px] text-[#D4A843] hover:text-[#F5F5F5] transition">
                  Want unlimited access? →
                </Link>
              </p>
            </motion.div>
          </div>
        </section>

        {/* ══════════ Ticker courbe ══════════ */}
        <div className="my-8 sm:my-12" style={FULL_BLEED}>
          <CurvedLoop
            text="AI Trading Coach ✦ Stop Overtrading ✦ Protect Your Funded Account ✦"
            speed={3}
            curveAmount={220}
            direction="left"
          />
        </div>

        {/* ══════════ TRACK RECORD ══════════ */}
        <section ref={trackRef} className="mx-auto w-full max-w-[900px] mb-10">
          <ZoomIn>
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
                    <TrackRecordCard key={s.label} value={s.value} label={s.label} inView={trackInView} delay={i * 0.15} />
                  ))}
                </div>
                <p className="text-center text-[11px] text-[#A1A1AA]/60 leading-relaxed">
                  Based on backtested research trades on XAUUSD. Past performance does not guarantee future results.
                </p>
              </div>
            </div>
          </ZoomIn>
        </section>

        {/* ══════════ CTA FINAL ══════════ */}
        <section className="text-center pt-10 sm:pt-16 pb-6">
          <div className="purple-shimmer-line max-w-[420px] mx-auto mb-14 sm:mb-16" />
          <Reveal>
            <h2 className="mx-auto max-w-[16ch] text-[30px] sm:text-[42px] md:text-[50px] leading-[1.08] tracking-[-0.03em] font-extrabold mb-8">
              The next drawdown is <span className="font-serif italic font-medium text-[#D4A843]">optional.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.15}>
            <PrimaryCTA />
            <p className="text-sm font-medium mt-6" style={{ color: "#D4A843" }}>{PRICING.betaLine}</p>
            <p className="text-xs font-normal mt-1" style={{ color: "#71717A" }}>{PRICING.urgencyLine}</p>
          </Reveal>
        </section>

      </div>
    </MotionConfig>
  );
}
