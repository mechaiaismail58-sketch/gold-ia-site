"use client";

import { motion } from "framer-motion";
import GoldTradingViewChart from "@/components/GoldTradingViewChart";

export const dynamic = "force-dynamic";

export default function ChatMarketPage() {
  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-[#0A0A0A]">
      {/* ── Header ── */}
      <div className="flex-none flex items-center justify-between px-6 md:px-10 py-4 border-b border-white/[0.06]">
        <h1 className="text-sm font-semibold uppercase text-white" style={{ letterSpacing: "0.1em" }}>
          XAUUSD — Live Market
        </h1>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.1em] text-[#D4A843]">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D4A843] opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full pulse-dot-gold" />
          </span>
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
          className="h-full overflow-hidden border border-white/[0.08] rounded-xl"
          style={{
            background: "#0D0D0D",
            boxShadow: "0 0 60px rgba(123,79,212,0.15)",
          }}
        >
          <GoldTradingViewChart />
        </div>
      </motion.div>
    </div>
  );
}
