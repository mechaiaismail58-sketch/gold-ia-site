"use client";

import { ReactLenis } from "lenis/react";
import { motion } from "framer-motion";
import Eyebrow from "@/components/design-system/Eyebrow";
import GlassCard from "@/components/design-system/GlassCard";

export const dynamic = "force-dynamic";

type Impact = "bullish" | "bearish" | "neutral";

type NewsItem = {
  title: string;
  source: string;
  date: string;
  impact: Impact;
};

// Sample feed shown while the live news API is being wired up.
// Flagged with a SAMPLE DATA badge so it's never mistaken for live data.
const NEWS_ITEMS: NewsItem[] = [
  {
    title: "Gold edges higher as dollar softens ahead of US CPI print",
    source: "Bloomberg",
    date: "Jun 15, 2026",
    impact: "bullish",
  },
  {
    title: "Fed holds rates steady, signals patience on cuts amid sticky inflation",
    source: "Reuters",
    date: "Jun 14, 2026",
    impact: "bearish",
  },
  {
    title: "CFTC COT: hedge funds lift net-long gold positions to a 6-week high",
    source: "Reuters",
    date: "Jun 13, 2026",
    impact: "bullish",
  },
  {
    title: "Gold-backed ETFs post largest weekly inflow since March",
    source: "Bloomberg",
    date: "Jun 13, 2026",
    impact: "bullish",
  },
  {
    title: "Treasury yields tick up as strong jobs data caps gold's advance",
    source: "Financial Times",
    date: "Jun 12, 2026",
    impact: "bearish",
  },
];

const IMPACT_TAG: Record<Impact, string> = {
  bullish: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25",
  bearish: "bg-red-500/10 text-red-400 border border-red-500/25",
  neutral: "bg-white/5 text-white/40 border border-white/10",
};

export default function ChatNewsPage() {
  return (
    <ReactLenis
      className="flex-1 overflow-y-auto px-6 py-12"
      options={{ lerp: 0.1, duration: 1.2, smoothWheel: true }}
    >
      <div className="w-full max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <Eyebrow className="text-center">Gold News &amp; Sentiment</Eyebrow>
          <h1 className="text-white text-[32px] font-semibold tracking-tight leading-[1.1] mt-4 mb-3">
            Market Intelligence
          </h1>
          <p className="text-[14px] leading-relaxed text-white/40">
            Curated gold-relevant news powered by AI analysis.
          </p>
        </div>

        {/* News feed */}
        <div className="relative">
          <span className="absolute -top-3 right-0 z-10 rounded-full bg-white/[0.06] border border-white/10 px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.1em] text-white/35">
            Sample data
          </span>

          <div className="flex flex-col gap-3">
            {NEWS_ITEMS.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut", delay: i * 0.06 }}
              >
                <GlassCard className="p-5 text-left transition-all duration-300 hover:bg-white/[0.05]">
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-[15px] font-semibold leading-snug text-white/90">
                      {item.title}
                    </p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide ${IMPACT_TAG[item.impact]}`}
                    >
                      {item.impact}
                    </span>
                  </div>
                  <div className="mt-3 font-mono text-[11px] tracking-[0.04em] text-white/30">
                    {item.source} · {item.date}
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </div>

        <p className="mt-8 text-center text-[11px] text-white/20">
          Live news feed launching soon — sentiment scoring in beta.
        </p>
      </div>
    </ReactLenis>
  );
}
