"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";

const GoldTradingViewChart = dynamic(
  () => import("@/components/GoldTradingViewChart"),
  { ssr: false, loading: () => <div className="w-full h-[500px] animate-pulse bg-white/[0.03] border border-white/[0.06] rounded-xl" /> }
);

export default function ChatMarketPage() {
  return (
    <div data-lenis-prevent className="flex-1 flex flex-col overflow-y-auto bg-transparent">
      {/* ── Header ── */}
      <div className="flex-none flex items-center justify-between px-6 md:px-10 py-4 border-b border-white/[0.06]">
        <h1 className="flex items-baseline gap-2.5">
          <span className="font-mono text-[15px] font-semibold text-[#D4A843] tracking-[0.08em]">XAUUSD</span>
          <span className="text-[11px] uppercase tracking-[0.1em] text-white/30">Live Market</span>
        </h1>
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.1em] text-[#D4A843]/70">
          <span className="h-1.5 w-1.5 rounded-full bg-[#D4A843]" style={{ boxShadow: "0 0 0 3px rgba(212,168,67,0.15)" }} />
          Live
        </div>
      </div>

      {/* ── Chart ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="flex-1 p-4 md:p-6"
      >
        <div
          className="h-full overflow-hidden border border-white/[0.06] rounded-xl"
          style={{ background: "#0D0D0D" }}
        >
          <GoldTradingViewChart />
        </div>
      </motion.div>
    </div>
  );
}
